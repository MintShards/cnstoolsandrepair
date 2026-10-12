import { useState, useEffect, useMemo } from 'react';
import { accountingAPI, staffAPI } from '../../../services/api';
import { useSettings } from '../../../contexts/SettingsContext';
import useCurrentUser from '../../../utils/useCurrentUser';
import { formatMoney } from '../../../utils/money';
import { formatYmd } from '../../../utils/dateFormat';
import { profitTone } from '../../../utils/jobAccounting';
import { customerSummary } from '../../../utils/customerAccounting';
import { CUSTOMER_PERIOD_PRESETS, ALL_TIME, presetRange, toCsv, downloadCsv, csvMoney } from '../../../utils/accounting';
import StatTile, { StatRow } from '../../workspace/StatTile';
import PeriodPicker from '../../workspace/PeriodPicker';
import { BTN_NEUTRAL } from '../../sales/ui';
import { isMobile } from '../../workspace/PrintDayClose';
import { openPrintCustomerStatement, openStatementTab } from './PrintCustomerStatement';

const money = (n) => (n == null ? '—' : formatMoney(n));
const pctText = (n) => (n == null ? '—' : `${n}%`);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const CSV_COLUMNS = [
  { label: 'Day', value: 'day' },
  { label: 'Work order', value: 'request_number' },
  { label: 'Tool', value: 'label' },
  { label: 'Technician', value: (r) => r.technician || '' },
  { label: 'Revenue', value: (r) => csvMoney(r.revenue) },
  { label: 'Parts cost', value: (r) => csvMoney(r.partsCost) },
  { label: 'Labour cost', value: (r) => csvMoney(r.labourCost) },
  { label: 'Other cost', value: (r) => csvMoney(r.otherCost) },
  { label: 'Cost', value: (r) => csvMoney(r.cost) },
  { label: 'Profit', value: (r) => csvMoney(r.profit) },
  { label: 'Margin %', value: (r) => (r.margin == null ? '' : r.margin) },
  { label: 'Payment', value: (r) => (r.paid ? 'Paid' : r.balance != null ? `Owing ${csvMoney(r.balance)}` : '') },
];

/**
 * The customer's accounting on their profile, admin only: revenue, cost,
 * profit and payments for a period (all time by default, or this year,
 * this month, a custom range), the position as of today (paid all time,
 * balance due, open work), and a year-by-year table — with a printable
 * statement and a CSV of the completed repairs. Same maths as the work
 * order dialog and the P&L (utils/customerAccounting.js), derived each time
 * the profile opens, never stored. Renders nothing for other roles.
 */
export default function CustomerAccounting({ customer }) {
  const customerId = customer?.id;
  const { isAdmin, loading: userLoading } = useCurrentUser();
  const { settings } = useSettings();
  const [data, setData] = useState(null);
  const [technicianRates, setTechnicianRates] = useState({});
  const [state, setState] = useState('loading'); // loading | ready | failed
  const [range, setRange] = useState(() => ({ preset: 'all', ...presetRange('all') }));

  useEffect(() => {
    if (!isAdmin || !customerId) return undefined;
    let alive = true;
    setState('loading');
    Promise.all([
      accountingAPI.customer(customerId),
      // A failed staff fetch only costs the technician rates, not the card.
      staffAPI.list().catch(() => []),
    ])
      .then(([res, staff]) => {
        if (!alive) return;
        const rates = {};
        for (const a of staff) {
          if (a.labour_cost_rate != null) rates[a.name] = { basis: a.labour_cost_basis || 'hourly', rate: a.labour_cost_rate };
        }
        setData(res);
        setTechnicianRates(rates);
        setState('ready');
      })
      .catch(() => { if (alive) setState('failed'); });
    return () => { alive = false; };
  }, [customerId, isAdmin]);

  const summary = useMemo(() => (data ? customerSummary(data, {
    from: range.from, to: range.to,
    labourCostRate: settings?.labourCostRate, gstRate: settings?.gstRate, pstRate: settings?.pstRate, technicianRates,
  }) : null), [data, range.from, range.to, settings?.labourCostRate, settings?.gstRate, settings?.pstRate, technicianRates]);

  // Custom straight after All time would show the open range's dates;
  // start it from this year instead.
  const changeRange = (next) => {
    if (next.preset === 'custom' && next.from === ALL_TIME.from) {
      setRange({ ...presetRange('year'), preset: 'custom' });
      return;
    }
    setRange(next);
  };

  const handlePrint = () => {
    if (!summary) return;
    // On a phone the tab must open inside the tap.
    const win = isMobile() ? openStatementTab() : null;
    openPrintCustomerStatement({ customer, summary, win }).catch(() => {});
  };

  const handleCsv = () => {
    if (!summary) return;
    const slug = (customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`)
      .trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'customer';
    const span = summary.allTime ? 'all-time' : `${summary.from}-to-${summary.to}`;
    downloadCsv(`customer-${slug}-${span}.csv`, toCsv(CSV_COLUMNS, summary.period.rows));
  };

  if (userLoading || !isAdmin) return null;

  const p = summary?.period;
  const n = summary?.now;
  const counts = summary?.counts;
  const inPeriod = summary?.allTime ? '' : ' in period';
  const balanceTone = n?.balance == null ? undefined
    : n.balance > 0 ? 'text-amber-700 dark:text-amber-400'
      : n.balance < 0 ? 'text-sky-700 dark:text-sky-400' : 'text-green-700 dark:text-green-400';

  return (
    <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2 flex-wrap">
        <div className="w-7 h-7 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 flex items-center justify-center">
          <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-sm">account_balance</span>
        </div>
        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">Accounting</h3>
        <span className="text-[10px] font-bold uppercase tracking-wide bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full" title="Cost and profit are admin-only figures">Admin only</span>
        {counts && (
          <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
            {plural(counts.jobs, 'work order')} · {plural(counts.tools, 'tool')}
            {counts.firstVisit ? ` · first ${formatYmd(counts.firstVisit)}` : ''}
            {counts.lastVisit && counts.lastVisit !== counts.firstVisit ? ` · last ${formatYmd(counts.lastVisit)}` : ''}
          </span>
        )}
      </div>

      {/* Period and the two outputs. The picker drops its dates under the
          presets when the row is narrow; the buttons take their own row on
          phones and sit at the right from sm up. */}
      <div className="px-4 pt-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
        <PeriodPicker value={range} onChange={changeRange} presets={CUSTOMER_PERIOD_PRESETS} className="min-w-0" />
        <div className="grid grid-cols-2 sm:flex gap-2 sm:ml-auto">
          <button type="button" onClick={handlePrint} disabled={!summary} className={`${BTN_NEUTRAL} justify-center`} title="Print or save the statement as PDF">
            <span className="material-symbols-outlined text-base">print</span>
            Print
          </button>
          <button type="button" onClick={handleCsv} disabled={!summary} className={`${BTN_NEUTRAL} justify-center`} title="The completed repairs in this period as a spreadsheet">
            <span className="material-symbols-outlined text-base">download</span>
            CSV
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {state === 'loading' ? (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-3xl text-primary animate-spin">refresh</span>
          </div>
        ) : state === 'failed' || !summary ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">Couldn’t load this customer’s accounting.</p>
        ) : (
          <>
            {/* The period: completed repairs at the P&L's rules and the money
                received. Balance due is always as of today. */}
            <StatRow>
              <StatTile label="Revenue" sub={p.completedTools ? `${plural(p.completedTools, 'repair')} completed${inPeriod}` : `nothing completed${inPeriod}`}>{money(p.revenue)}</StatTile>
              <StatTile label="Cost to shop" sub={p.uncostedParts ? `${plural(p.uncostedParts, 'part')} without a cost` : 'labour, parts, expenses'}>{money(p.cost)}</StatTile>
              <StatTile label="Profit" sub={p.margin == null ? 'pre-tax' : `${pctText(p.margin)} of revenue`} tone={profitTone(p.profit)}>{money(p.profit)}</StatTile>
              <StatTile label="Paid" sub={summary.allTime ? 'received, all time' : 'received in period'}>{money(p.paid)}</StatTile>
              <StatTile
                label="Balance due"
                sub={n.balance == null ? 'nothing invoiced yet' : n.balance > 0 ? `today, on ${plural(n.invoicedJobs, 'invoiced work order')}` : n.balance < 0 ? 'overpaid, as of today' : 'paid in full'}
                tone={balanceTone}
              >
                {money(n.balance)}
              </StatTile>
            </StatRow>

            {/* A data-hygiene flag stays in view; it asks for action. */}
            {summary.matched.by_name > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {plural(summary.matched.by_name, 'work order')} matched by company name or email only — from before the profile existed. Open and re-save the customer on those to link them.
              </p>
            )}

            {/* The detail — averages, open work, year by year — comes out
                only once a period is chosen; All time stays at the five
                figures, so a profile open is not a wall of money. */}
            <div>
              {!summary.allTime && (
                <div className="space-y-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    {p.averagePerJob != null && (
                      <p>Average revenue per completed work order{inPeriod}: <span className="font-bold text-slate-700 dark:text-slate-200">{money(p.averagePerJob)}</span></p>
                    )}
                    {!summary.allTime && n.received != null && (
                      <p>Paid all time: <span className="font-bold text-slate-700 dark:text-slate-200">{money(n.received)}</span></p>
                    )}
                    {n.open.tools > 0 ? (
                      <p>
                        Open now: <span className="font-bold text-slate-700 dark:text-slate-200">{plural(n.open.tools, 'tool')}</span> on {plural(n.open.jobs, 'work order')}
                        {n.open.revenue != null ? <> — expected revenue <span className="font-bold text-slate-700 dark:text-slate-200">{money(n.open.revenue)}</span>, not counted above until completed</> : ' — nothing priced yet'}
                      </p>
                    ) : (
                      <p>Nothing open right now.</p>
                    )}
                  </div>

                  {/* Year by year — a repair counts in the year its tool was completed. */}
                  {summary.byYear.length > 0 && (
                    <div className="overflow-x-auto -mx-4 px-4">
                      <table className="w-full text-xs min-w-[560px]">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/60">
                            <th className="text-left py-1.5 pr-2 font-bold">Year</th>
                            <th className="text-right py-1.5 px-2 font-bold">Repairs</th>
                            <th className="text-right py-1.5 px-2 font-bold">Work orders</th>
                            <th className="text-right py-1.5 px-2 font-bold">Revenue</th>
                            <th className="text-right py-1.5 px-2 font-bold">Cost</th>
                            <th className="text-right py-1.5 px-2 font-bold">Profit</th>
                            <th className="text-right py-1.5 px-2 font-bold">Margin</th>
                            <th className="text-right py-1.5 pl-2 font-bold">Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.byYear.map((y) => (
                            <tr key={y.year} className="border-b border-slate-100 dark:border-slate-700/40 last:border-0">
                              <td className="py-1.5 pr-2 font-bold text-slate-800 dark:text-slate-100">{y.year}</td>
                              <td className="py-1.5 px-2 text-right text-slate-600 dark:text-slate-300">{y.tools || '—'}</td>
                              <td className="py-1.5 px-2 text-right text-slate-600 dark:text-slate-300">{y.jobs || '—'}</td>
                              <td className="py-1.5 px-2 text-right font-semibold text-slate-800 dark:text-slate-100">{money(y.revenue)}</td>
                              <td className="py-1.5 px-2 text-right text-slate-600 dark:text-slate-300">{money(y.cost)}</td>
                              <td className={`py-1.5 px-2 text-right font-semibold ${profitTone(y.profit)}`}>{money(y.profit)}</td>
                              <td className="py-1.5 px-2 text-right text-slate-600 dark:text-slate-300">{pctText(y.margin)}</td>
                              <td className="py-1.5 pl-2 text-right text-slate-600 dark:text-slate-300">{money(y.paid)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
