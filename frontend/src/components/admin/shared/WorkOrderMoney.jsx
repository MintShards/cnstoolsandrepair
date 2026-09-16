import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { billsAPI, paymentsAPI } from '../../../services/api';
import { formatMoney, round2 } from '../../../utils/money';
import { formatYmd, getTodayPacific } from '../../../utils/dateFormat';
import { isBillOverdue, PAYMENT_METHODS } from '../../../constants/bills';
import BillStatusPill from '../../workspace/BillStatusPill';

const BTN = 'inline-flex items-center gap-1 px-2.5 py-1 min-h-[44px] sm:min-h-0 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-bold transition-all';

/** This job's share of a bill: the priced lines linked to it. */
function jobShare(bill, jobId) {
  const priced = (bill.lines || []).filter((l) => l.repair_id === jobId && l.line_total != null);
  return priced.length ? round2(priced.reduce((s, l) => s + l.line_total, 0)) : null;
}

function addTo(map, currency, amount) {
  map[currency || 'CAD'] = round2((map[currency || 'CAD'] || 0) + (amount || 0));
}

function money(map) {
  const entries = Object.entries(map).filter(([, v]) => v !== 0);
  if (entries.length === 0) return formatMoney(0);
  entries.sort(([a], [b]) => (a === 'CAD' ? -1 : b === 'CAD' ? 1 : 0));
  return entries.map(([c, v]) => formatMoney(v, c)).join(' + ');
}

/**
 * The work order's money, read live from Cash Flow (admin only — the parent
 * decides whether to render this). Bills linked through their lines are money
 * out for this job; payments linked to it are money in. Everything links back
 * to the Cash Flow record, and the two buttons log new ones prefilled.
 */
export default function WorkOrderMoney({ job, refreshTick, onLogBill, onLogPayment }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, p] = await Promise.all([
        billsAPI.list({ repair_id: job.id, status: 'all', limit: 200 }),
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
  const cost = {};
  const received = {};
  bills.filter((b) => b.status !== 'void').forEach((b) => {
    const share = jobShare(b, job.id);
    if (share != null) addTo(cost, b.currency, share);
  });
  payments.forEach((p) => addTo(received, p.currency, p.amount));
  const net = {};
  new Set([...Object.keys(cost), ...Object.keys(received)]).forEach((c) => {
    net[c] = round2((received[c] || 0) - (cost[c] || 0));
  });
  const netCad = net.CAD ?? 0;
  const empty = data && bills.length === 0 && payments.length === 0;

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
        {failed ? (
          <p className="text-sm text-red-600 dark:text-red-400">Could not load this job’s bills and payments.</p>
        ) : !data ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Parts & bills', money(cost), 'text-slate-900 dark:text-white'],
                ['Received', money(received), 'text-green-700 dark:text-green-400'],
                ['Net', money(net), netCad < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'],
              ].map(([label, value, tone]) => (
                <div key={label} className="rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-700/40 px-3 py-2 min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
                  <span className={`block text-sm sm:text-base font-black truncate ${tone}`}>{value}</span>
                </div>
              ))}
            </div>

            {empty ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">No bills or payments linked to this work order yet.</p>
            ) : (
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
                        return (
                          <li key={b.id}>
                            <Link
                              to={`/workspace?section=cash-flow&bill=${b.id}`}
                              className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 hover:border-primary/50 transition-colors"
                              title="Open in Cash Flow"
                            >
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
                          <Link
                            to={`/workspace?section=cash-flow&payment=${p.id}`}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 hover:border-primary/50 transition-colors"
                            title="Open in Cash Flow"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">{formatYmd(p.received_date)}{p.payment_method ? ` · ${PAYMENT_METHODS[p.payment_method]}` : ''}</span>
                              <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                <span className="font-mono">{p.payment_number}</span>
                                {p.zoho_invoice_number && ` · Zoho ${p.zoho_invoice_number}`}
                              </span>
                            </span>
                            <span className="text-xs font-black text-green-700 dark:text-green-400 whitespace-nowrap">{formatMoney(p.amount, p.currency)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
            {bills.some((b) => jobShare(b, job.id) == null && b.status !== 'void') && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">* whole bill shown — its lines for this job carry no prices, so it is left out of the totals.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
