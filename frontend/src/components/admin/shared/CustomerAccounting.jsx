import { useState, useEffect, useMemo } from 'react';
import { accountingAPI, staffAPI } from '../../../services/api';
import { useSettings } from '../../../contexts/SettingsContext';
import useCurrentUser from '../../../utils/useCurrentUser';
import { formatMoney } from '../../../utils/money';
import { formatYmd } from '../../../utils/dateFormat';
import { profitTone } from '../../../utils/jobAccounting';
import { customerSummary } from '../../../utils/customerAccounting';
import StatTile, { StatRow } from '../../workspace/StatTile';

const money = (n) => (n == null ? '—' : formatMoney(n));
const pctText = (n) => (n == null ? '—' : `${n}%`);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The customer's accounting on their profile, admin only: lifetime revenue,
 * cost, profit, paid and balance across every work order of theirs, what is
 * open right now, and a year-by-year table. Same maths as the work order
 * dialog and the P&L (utils/customerAccounting.js) — derived each time the
 * profile opens, never stored. Renders nothing for other roles.
 */
export default function CustomerAccounting({ customerId }) {
  const { isAdmin, loading: userLoading } = useCurrentUser();
  const { settings } = useSettings();
  const [data, setData] = useState(null);
  const [technicianRates, setTechnicianRates] = useState({});
  const [state, setState] = useState('loading'); // loading | ready | failed

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
    labourCostRate: settings?.labourCostRate, gstRate: settings?.gstRate, pstRate: settings?.pstRate, technicianRates,
  }) : null), [data, settings?.labourCostRate, settings?.gstRate, settings?.pstRate, technicianRates]);

  if (userLoading || !isAdmin) return null;

  const l = summary?.lifetime;
  const counts = summary?.counts;
  const open = summary?.open;
  const balanceTone = l?.balance == null ? undefined
    : l.balance > 0 ? 'text-amber-700 dark:text-amber-400'
      : l.balance < 0 ? 'text-sky-700 dark:text-sky-400' : 'text-green-700 dark:text-green-400';

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

      <div className="p-4 space-y-4">
        {state === 'loading' ? (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-3xl text-primary animate-spin">refresh</span>
          </div>
        ) : state === 'failed' || !summary ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">Couldn’t load this customer’s accounting.</p>
        ) : (
          <>
            {/* Lifetime: completed repairs at the P&L's rules, money in and what is owed. */}
            <StatRow>
              <StatTile label="Revenue" sub={l.completedTools ? `${plural(l.completedTools, 'repair')} completed` : 'nothing completed yet'}>{money(l.revenue)}</StatTile>
              <StatTile label="Cost to shop" sub={l.uncostedParts ? `${plural(l.uncostedParts, 'part')} without a cost` : 'labour, parts, expenses'}>{money(l.cost)}</StatTile>
              <StatTile label="Profit" sub={l.margin == null ? 'pre-tax' : `${pctText(l.margin)} of revenue`} tone={profitTone(l.profit)}>{money(l.profit)}</StatTile>
              <StatTile label="Paid" sub="received, all time">{money(l.received)}</StatTile>
              <StatTile
                label="Balance due"
                sub={l.balance == null ? 'nothing invoiced yet' : l.balance > 0 ? `on ${plural(l.invoicedJobs, 'invoiced work order')}` : l.balance < 0 ? 'overpaid' : 'paid in full'}
                tone={balanceTone}
              >
                {money(l.balance)}
              </StatTile>
            </StatRow>

            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              {l.averagePerJob != null && (
                <p>Average revenue per completed work order: <span className="font-bold text-slate-700 dark:text-slate-200">{money(l.averagePerJob)}</span></p>
              )}
              {open.tools > 0 && (
                <p>
                  Open now: <span className="font-bold text-slate-700 dark:text-slate-200">{plural(open.tools, 'tool')}</span> on {plural(open.jobs, 'work order')}
                  {open.revenue != null ? <> — expected revenue <span className="font-bold text-slate-700 dark:text-slate-200">{money(open.revenue)}</span>, not counted above until completed</> : ' — nothing priced yet'}
                </p>
              )}
              {summary.matched.by_name > 0 && (
                <p className="text-amber-700 dark:text-amber-400">
                  {plural(summary.matched.by_name, 'work order')} matched by company name or email only — from before the profile existed. Open and re-save the customer on those to link them.
                </p>
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
          </>
        )}
      </div>
    </div>
  );
}
