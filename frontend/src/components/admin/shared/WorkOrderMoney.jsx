import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { billsAPI, paymentsAPI } from '../../../services/api';
import { formatMoney, round2, totalsByCurrency } from '../../../utils/money';
import { formatYmd, getTodayPacific } from '../../../utils/dateFormat';
import { isBillOverdue, PAYMENT_METHODS } from '../../../constants/bills';
import BillStatusPill from '../../workspace/BillStatusPill';

const BTN = 'inline-flex items-center gap-1 px-2.5 py-1 min-h-[44px] sm:min-h-0 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-bold transition-all';
const ROW = 'flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 hover:border-primary/50 transition-colors';

/** This job's share of a bill: the priced lines linked to it. */
function jobShare(bill, jobId) {
  const priced = (bill.lines || []).filter((l) => l.repair_id === jobId && l.line_total != null);
  return priced.length ? round2(priced.reduce((s, l) => s + l.line_total, 0)) : null;
}

function addTo(map, currency, amount) {
  map[currency || 'CAD'] = round2((map[currency || 'CAD'] || 0) + (amount || 0));
}

/** One figure per currency, stacked — never a mixed sum, never a "+ US$" tail cut off. */
function MoneyLines({ totals, tone }) {
  const parts = totalsByCurrency(totals);
  if (parts.length === 0) return <span className={`block text-sm sm:text-base font-black ${tone}`}>{formatMoney(0)}</span>;
  return (
    <>
      <span className={`block text-sm sm:text-base font-black truncate ${tone}`}>{formatMoney(parts[0].amount, parts[0].currency)}</span>
      {parts.slice(1).map((p) => (
        <span key={p.currency} className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
          {p.amount < 0 ? '−' : '+'} {formatMoney(Math.abs(p.amount), p.currency)}
        </span>
      ))}
    </>
  );
}

function moneyTitle(totals) {
  const parts = totalsByCurrency(totals);
  return parts.length ? parts.map((p) => formatMoney(p.amount, p.currency)).join(' and ') : formatMoney(0);
}

/**
 * What the tracker says this job should bring in, before tax: labour at
 * hours × rate and parts at the customer's price — the same arithmetic the
 * tool cards and the printed work order use. Zoho Books owns the real
 * invoice; this is the bench estimate to collect against.
 */
function jobEstimate(job) {
  let hours = 0;
  let labour = 0;
  let parts = 0;
  let unrated = false;
  for (const t of job.tools || []) {
    const h = parseFloat(t.labour_hours);
    const r = parseFloat(t.hourly_rate);
    if (h > 0) {
      hours += h;
      if (r > 0) labour += h * r;
      else unrated = true;
    }
    for (const p of t.parts || []) {
      if (!p.name?.trim() || p.price == null || p.price === '') continue;
      parts += parseFloat(p.price) * (p.quantity || 1);
    }
  }
  return {
    hours: round2(hours), labour: round2(labour), parts: round2(parts),
    total: round2(labour + parts), unrated, priced: labour > 0 || parts > 0,
  };
}

/**
 * The work order's money, read live from Cash Flow (admin only — the parent
 * decides whether to render this). Bills linked through their lines are money
 * out for this job; payments linked to it are money in. Everything links back
 * to the Cash Flow record, and the two buttons log new ones prefilled. Void
 * bills are left out entirely (the list uses the API's default filter).
 */
export default function WorkOrderMoney({ job, refreshTick, onLogBill, onLogPayment }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, p] = await Promise.all([
        billsAPI.list({ repair_id: job.id, limit: 200 }),
        paymentsAPI.list({ repair_id: job.id, limit: 200 }),
      ]);
      setData({ bills: b.bills, payments: p.payments });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [job.id]);

  useEffect(() => { load(); }, [load, refreshTick]);

  const today = getTodayPacific();
  const bills = data?.bills || [];
  const payments = data?.payments || [];
  const out = {};
  const inn = {};
  bills.forEach((b) => {
    const share = jobShare(b, job.id);
    if (share != null) addTo(out, b.currency, share);
  });
  payments.forEach((p) => addTo(inn, p.currency, p.amount));
  const net = {};
  new Set([...Object.keys(out), ...Object.keys(inn)]).forEach((c) => {
    net[c] = round2((inn[c] || 0) - (out[c] || 0));
  });
  const netCad = net.CAD ?? 0;
  const empty = data && bills.length === 0 && payments.length === 0;
  const unpriced = bills.some((b) => jobShare(b, job.id) == null);
  // Tracker prices are CAD; only CAD payments count against the estimate.
  const est = jobEstimate(job);
  const outstanding = round2(est.total - (inn.CAD || 0));

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
      <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40">
        <span className="material-symbols-outlined text-slate-500 dark:text-slate-400" style={{ fontSize: '14px' }}>account_balance_wallet</span>
        <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Money on this job</h4>
        <span className="hidden lg:inline text-[11px] text-slate-400 dark:text-slate-500">admin only · live from Cash Flow</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={onLogBill} className={BTN} title="Log a supplier bill for this job">
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>receipt_long</span>
            Log a bill
          </button>
          <button type="button" onClick={onLogPayment} className={BTN} title="Log a customer payment for this job">
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>payments</span>
            Log a payment
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* The customer's side of the job, from the tool cards: what to collect. */}
        {est.priced && (
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600/60 px-3 py-2 text-xs" title="Labour is hours × rate and parts are at the customer's price, from the tool cards below. Before tax — Zoho Books has the real invoice.">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">To collect · tracker estimate, before tax</span>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-slate-600 dark:text-slate-300">
              <span>
                Labour <span className="font-bold text-slate-900 dark:text-white">{formatMoney(est.labour)}</span>
                {est.hours > 0 && <span className="text-slate-500 dark:text-slate-400"> · {est.hours} h{est.unrated ? ', rate missing on a tool' : ''}</span>}
              </span>
              <span>Parts <span className="font-bold text-slate-900 dark:text-white">{formatMoney(est.parts)}</span></span>
              <span>Total <span className="font-bold text-slate-900 dark:text-white">{formatMoney(est.total)}</span></span>
              <span className="ml-auto">
                {outstanding > 0
                  ? <>Still to collect <span className="font-black text-amber-700 dark:text-amber-400">{formatMoney(outstanding)}</span></>
                  : <span className="font-bold text-green-700 dark:text-green-400">Collected in full</span>}
              </span>
            </div>
          </div>
        )}
        {failed ? (
          <p className="text-sm text-red-600 dark:text-red-400">Could not load this job’s bills and payments.</p>
        ) : !data ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>
        ) : empty ? (
          // Nothing yet: one quiet line instead of three zero tiles.
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">No bills or payments on this work order yet — log them from the buttons above.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Money out', out, 'text-slate-900 dark:text-white'],
                ['Money in', inn, 'text-green-700 dark:text-green-400'],
                ['Net', net, netCad < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'],
              ].map(([label, totals, tone]) => (
                <div key={label} className="rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-700/40 px-3 py-2 min-w-0" title={`${label}: ${moneyTitle(totals)}`}>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
                  <MoneyLines totals={totals} tone={tone} />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Bills ({bills.length})</p>
                {bills.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic">None linked.</p>
                ) : (
                  <ul className="space-y-1">
                    {bills.map((b) => {
                      const share = jobShare(b, job.id);
                      const overdue = isBillOverdue(b, today);
                      // The bill's lines for THIS job: what was actually bought for it.
                      const mine = (b.lines || []).filter((l) => l.repair_id === job.id);
                      return (
                        <li key={b.id}>
                          <Link to={`/workspace?section=cash-flow&bill=${b.id}`} className={ROW} title={`Open ${b.bill_number} in Cash Flow`}>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">{b.supplier_name}</span>
                              <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                <span className="font-mono">{b.bill_number}</span>
                                {b.due_date && (
                                  <span className={overdue ? 'text-red-600 dark:text-red-400 font-bold' : ''}> · due {formatYmd(b.due_date)}{overdue ? ' · overdue' : ''}</span>
                                )}
                              </span>
                            </span>
                            <BillStatusPill status={b.status} small />
                            <span className="text-xs font-black text-slate-900 dark:text-white whitespace-nowrap" title={share == null ? 'No priced lines for this job — showing the whole bill' : 'This job’s share of the bill'}>
                              {share != null ? formatMoney(share, b.currency) : `${formatMoney(b.total, b.currency)}*`}
                            </span>
                          </Link>
                          {mine.length > 0 && (
                            <ul className="mt-1 mb-1.5 ml-3 mr-1 space-y-0.5">
                              {mine.map((l, i) => (
                                <li key={i} className="flex items-baseline justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                  <span className="min-w-0 truncate">
                                    {l.description}
                                    {l.part_number && <span className="text-slate-500 dark:text-slate-400"> · {l.part_number}</span>}
                                  </span>
                                  <span className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                                    {l.quantity}{l.unit_price != null ? ` × ${formatMoney(l.unit_price, b.currency)}` : ''}
                                    {l.line_total != null && <span className="ml-1.5 font-bold text-slate-700 dark:text-slate-200">{formatMoney(l.line_total, b.currency)}</span>}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Payments ({payments.length})</p>
                {payments.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic">Nothing received yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {payments.map((p) => (
                      <li key={p.id}>
                        <Link to={`/workspace?section=cash-flow&payment=${p.id}`} className={ROW} title={`Open ${p.payment_number} in Cash Flow`}>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">{formatYmd(p.received_date)}{p.payment_method ? ` · ${PAYMENT_METHODS[p.payment_method]}` : ''}</span>
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              <span className="font-mono">{p.payment_number}</span>
                              {p.zoho_invoice_number && ` · Zoho ${p.zoho_invoice_number}`}
                            </span>
                          </span>
                          <span className="text-xs font-black text-slate-900 dark:text-white whitespace-nowrap">{formatMoney(p.amount, p.currency)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {unpriced && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">* whole bill shown — its lines for this job carry no prices, so it is left out of the totals.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
