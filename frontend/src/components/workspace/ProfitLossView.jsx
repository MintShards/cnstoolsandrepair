import { useState, useEffect, useCallback, useMemo } from 'react';
import { accountingAPI, staffAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import { useSettings } from '../../contexts/SettingsContext';
import TabHeader from '../sales/TabHeader';
import { BTN_NEUTRAL } from '../sales/ui';
import { formatMoney } from '../../utils/money';
import { formatYmd } from '../../utils/dateFormat';
import { profitTone } from '../../utils/jobAccounting';
import { pnlRows, presetRange, journalEntries, toCsv, downloadCsv, csvMoney } from '../../utils/accounting';
import PeriodPicker from './PeriodPicker';
import StatTile, { StatRow } from './StatTile';
import WorkOrderChip from './WorkOrderChip';
import { openPrintDayClose, openCloseTab, isMobile } from './PrintDayClose';

const money = (n) => (n == null ? '—' : formatMoney(n));
const pctText = (n) => (n == null ? '—' : `${n}%`);

function PaymentCell({ row }) {
  if (row.paid) return <span className="text-xs font-bold text-green-700 dark:text-green-400">Paid</span>;
  if (row.balance != null) return <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Owing {formatMoney(row.balance)}</span>;
  return <span className="text-xs text-slate-400">—</span>;
}

/**
 * Profit & Loss (admin only): one row per tool completed in the period,
 * with the same figures the work order dialog shows for it, plus the
 * period's totals and a day-by-day strip. A repair counts on the day its
 * tool was marked Completed, paid or not; payments show in Money In.
 */
export default function ProfitLossView({ focusTick }) {
  const showToast = useToast();
  const { settings } = useSettings();
  const [range, setRange] = useState(() => ({ preset: 'today', ...presetRange('today') }));
  const [data, setData] = useState(null);
  const [technicianRates, setTechnicianRates] = useState({});
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async (withSpinner) => {
    if (withSpinner) setLoading(true);
    try {
      const [res, staff] = await Promise.all([
        accountingAPI.pnl(range.from, range.to),
        // A failed staff fetch only costs the technician rates, not the view.
        staffAPI.list().catch(() => []),
      ]);
      const rates = {};
      for (const a of staff) {
        if (a.labour_cost_rate != null) rates[a.name] = { basis: a.labour_cost_basis || 'hourly', rate: a.labour_cost_rate };
      }
      setData(res);
      setTechnicianRates(rates);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to load the profit and loss.'));
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, [range.from, range.to, showToast]);

  useEffect(() => { load(true); }, [load]);
  useEffect(() => {
    if (focusTick > 0) load(false);
  }, [focusTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const opts = useMemo(() => ({
    from: range.from, to: range.to,
    labourCostRate: settings?.labourCostRate, gstRate: settings?.gstRate, pstRate: settings?.pstRate,
    technicianRates,
  }), [range.from, range.to, settings?.labourCostRate, settings?.gstRate, settings?.pstRate, technicianRates]);
  const pnl = useMemo(() => (data ? pnlRows(data, opts) : null), [data, opts]);
  const single = range.from === range.to;
  const t = pnl?.totals;

  const exportCsv = () => {
    if (!pnl) return;
    const columns = [
      { label: 'Completed', value: 'day' },
      { label: 'Work order', value: 'request_number' },
      { label: 'Customer', value: 'customer' },
      { label: 'Tool', value: 'label' },
      { label: 'Technician', value: (r) => r.technician || '' },
      { label: 'Revenue (pre-tax)', value: (r) => csvMoney(r.revenue) },
      { label: 'Invoiced amount typed', value: (r) => (r.invoiced ? 'yes' : 'no') },
      { label: 'Zoho invoice', value: (r) => r.zoho_invoice_number || '' },
      { label: 'Parts cost', value: (r) => csvMoney(r.partsCost) },
      { label: 'Labour cost', value: (r) => csvMoney(r.labourCost) },
      { label: 'Other cost', value: (r) => csvMoney(r.otherCost) },
      { label: 'Total cost', value: (r) => csvMoney(r.cost) },
      { label: 'Profit', value: (r) => csvMoney(r.profit) },
      { label: 'Margin %', value: (r) => (r.margin == null ? '' : r.margin) },
      { label: 'Received', value: (r) => csvMoney(r.received) },
      { label: 'Balance', value: (r) => csvMoney(r.balance) },
      { label: 'Uncosted parts', value: 'uncostedParts' },
    ];
    downloadCsv(`profit-loss-${range.from}${single ? '' : `-to-${range.to}`}.csv`, toCsv(columns, pnl.rows));
  };

  const printClose = async () => {
    if (!pnl) return;
    // Phones get the report in a new tab, which Safari only allows inside
    // the tap itself — open it now, fill it once the journal has loaded.
    const win = isMobile() ? openCloseTab() : null;
    if (isMobile() && !win) { showToast('error', 'Allow pop-ups to print from a phone.'); return; }
    setPrinting(true);
    try {
      const j = await accountingAPI.journal(range.from, range.to);
      const journal = journalEntries(j, opts);
      await openPrintDayClose({ from: range.from, to: range.to, pnl, journal, win });
    } catch (err) {
      if (win) win.close();
      showToast('error', apiErrorMessage(err, 'Failed to build the close.'));
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div>
      {/* Same toolbar recipe as the bills and payments lists: the period on
          the left, the actions on the right; phones get the period full
          width with the two buttons split beneath it. */}
      <TabHeader>
        <PeriodPicker value={range} onChange={setRange} className="col-span-2" />
        <button type="button" onClick={exportCsv} disabled={!pnl?.rows.length} className={`${BTN_NEUTRAL} min-h-11 sm:min-h-0 sm:ml-auto disabled:opacity-50`} title="Download these rows as a spreadsheet">
          <span className="material-symbols-outlined text-base">download</span>
          Export CSV
        </button>
        <button type="button" onClick={printClose} disabled={!pnl || printing} className={`${BTN_NEUTRAL} min-h-11 sm:min-h-0 disabled:opacity-50`} title="Print the profit and loss with the money journal for this period">
          <span className="material-symbols-outlined text-base">print</span>
          {printing ? 'Preparing…' : single ? 'Print day close' : 'Print period close'}
        </button>
      </TabHeader>

      <StatRow className="mb-4">
        <StatTile label="Repairs completed" sub={t?.unpaid ? `${t.unpaid} not paid yet` : single ? formatYmd(range.from) : `${formatYmd(range.from)} – ${formatYmd(range.to)}`}>{t ? t.count : '—'}</StatTile>
        <StatTile label="Revenue" sub="pre-tax">{money(t?.revenue)}</StatTile>
        <StatTile label="Cost to shop" sub={t ? `parts ${money(t.partsCost)} · labour ${money(t.labourCost)}` : ''}>{money(t?.cost)}</StatTile>
        <StatTile label="Profit" sub="revenue − cost" tone={profitTone(t?.profit)}>{money(t?.profit)}</StatTile>
        <StatTile label="Margin" sub="profit ÷ revenue">{pctText(t?.margin)}</StatTile>
      </StatRow>

      {!single && pnl && pnl.days.length > 1 && (
        <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="text-left px-2 xl:px-3 py-2 font-bold">Day</th>
                <th className="text-right px-2 xl:px-3 py-2 font-bold">Repairs</th>
                <th className="text-right px-2 xl:px-3 py-2 font-bold">Revenue</th>
                <th className="text-right px-2 xl:px-3 py-2 font-bold hidden lg:table-cell">Cost</th>
                <th className="text-right px-2 xl:px-3 py-2 font-bold">Profit</th>
                <th className="text-right px-2 xl:px-3 py-2 font-bold hidden lg:table-cell">Margin</th>
              </tr>
            </thead>
            <tbody>
              {pnl.days.map((d) => (
                <tr key={d.day} className="border-t border-slate-100 dark:border-slate-700/60">
                  <td className="px-2 xl:px-3 py-2 text-slate-700 dark:text-slate-200">{formatYmd(d.day)}</td>
                  <td className="px-2 xl:px-3 py-2 text-right text-slate-700 dark:text-slate-200">{d.count}</td>
                  <td className="px-2 xl:px-3 py-2 text-right text-slate-700 dark:text-slate-200">{money(d.revenue)}</td>
                  <td className="px-2 xl:px-3 py-2 text-right text-slate-700 dark:text-slate-200 hidden lg:table-cell">{money(d.cost)}</td>
                  <td className={`px-2 xl:px-3 py-2 text-right font-bold ${profitTone(d.profit)}`}>{money(d.profit)}</td>
                  <td className="px-2 xl:px-3 py-2 text-right text-slate-500 dark:text-slate-400 hidden lg:table-cell">{pctText(d.margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
        {loading && !pnl ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined animate-spin text-slate-400 text-3xl">progress_activity</span>
          </div>
        ) : !pnl || pnl.rows.length === 0 ? (
          <div className="text-center py-16 px-4 text-slate-500 dark:text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block text-slate-300 dark:text-slate-600">trending_up</span>
            <p className="font-bold">No repairs completed {single ? 'on this day' : 'in this period'}.</p>
            <p className="text-sm mt-1">A repair appears here on the day its tool is marked Completed.</p>
          </div>
        ) : (
          <>
            {/* The table waits for lg: below that the sidebar rail leaves a
                phone-wide column, so the cards serve. The cost breakdown
                (parts, labour, other) and the margin column need xl; lg gets
                one Cost column and the margin beside the profit. */}
            <table className="hidden lg:table w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  {!single && <th className="text-left px-2 xl:px-3 py-2 font-bold">Day</th>}
                  <th className="text-left px-2 xl:px-3 py-2 font-bold">Work order</th>
                  <th className="text-left px-2 xl:px-3 py-2 font-bold">Customer · tool</th>
                  <th className="text-right px-2 xl:px-3 py-2 font-bold">Revenue</th>
                  <th className="text-right px-2 xl:px-3 py-2 font-bold hidden xl:table-cell">Parts</th>
                  <th className="text-right px-2 xl:px-3 py-2 font-bold hidden xl:table-cell">Labour</th>
                  <th className="text-right px-2 xl:px-3 py-2 font-bold hidden xl:table-cell">Other</th>
                  <th className="text-right px-2 xl:px-3 py-2 font-bold xl:hidden">Cost</th>
                  <th className="text-right px-2 xl:px-3 py-2 font-bold">Profit</th>
                  <th className="text-right px-2 xl:px-3 py-2 font-bold hidden xl:table-cell">Margin</th>
                  <th className="text-left px-2 xl:px-3 py-2 font-bold">Payment</th>
                </tr>
              </thead>
              <tbody>
                {pnl.rows.map((r) => (
                  <tr key={r.key} className="border-t border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/30">
                    {!single && <td className="px-2 xl:px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatYmd(r.day)}</td>}
                    <td className="px-2 xl:px-3 py-2"><WorkOrderChip repairId={r.job_id} requestNumber={r.request_number} /></td>
                    {/* w-full max-w-0: absorbs the leftover width and truncates,
                        so the table never outgrows its container. */}
                    <td className="px-2 xl:px-3 py-2 w-full max-w-0">
                      <span className="block font-bold text-slate-900 dark:text-white uppercase truncate">{r.customer}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 uppercase truncate">{r.label}{r.technician ? ` · ${r.technician}` : ''}</span>
                    </td>
                    <td className="px-2 xl:px-3 py-2 text-right whitespace-nowrap text-slate-900 dark:text-white font-semibold">{money(r.revenue)}</td>
                    <td className="px-2 xl:px-3 py-2 text-right whitespace-nowrap text-slate-600 dark:text-slate-300 hidden xl:table-cell">{money(r.partsCost)}{r.uncostedParts ? <span className="text-amber-600 dark:text-amber-400" title={`${r.uncostedParts} part(s) with no cost`}>*</span> : null}</td>
                    <td className="px-2 xl:px-3 py-2 text-right whitespace-nowrap text-slate-600 dark:text-slate-300 hidden xl:table-cell">{money(r.labourCost)}</td>
                    <td className="px-2 xl:px-3 py-2 text-right whitespace-nowrap text-slate-600 dark:text-slate-300 hidden xl:table-cell">{money(r.otherCost)}</td>
                    <td className="px-2 xl:px-3 py-2 text-right whitespace-nowrap text-slate-600 dark:text-slate-300 xl:hidden">{money(r.cost)}{r.uncostedParts ? <span className="text-amber-600 dark:text-amber-400" title={`${r.uncostedParts} part(s) with no cost`}>*</span> : null}</td>
                    <td className={`px-2 xl:px-3 py-2 text-right whitespace-nowrap font-bold ${profitTone(r.profit)}`}>
                      {money(r.profit)}
                      {r.margin != null && <span className="xl:hidden text-[10px] font-medium text-slate-400"> {r.margin}%</span>}
                    </td>
                    <td className="px-2 xl:px-3 py-2 text-right whitespace-nowrap text-slate-500 dark:text-slate-400 hidden xl:table-cell">{pctText(r.margin)}</td>
                    <td className="px-2 xl:px-3 py-2 whitespace-nowrap"><PaymentCell row={r} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 font-bold">
                  <td className="px-2 xl:px-3 py-2 text-slate-900 dark:text-white whitespace-nowrap" colSpan={single ? 2 : 3}>Total · {t.count} repair{t.count === 1 ? '' : 's'}</td>
                  <td className="px-2 xl:px-3 py-2 text-right whitespace-nowrap text-slate-900 dark:text-white">{money(t.revenue)}</td>
                  <td className="px-2 xl:px-3 py-2 text-right whitespace-nowrap text-slate-700 dark:text-slate-200 hidden xl:table-cell">{money(t.partsCost)}</td>
                  <td className="px-2 xl:px-3 py-2 text-right whitespace-nowrap text-slate-700 dark:text-slate-200 hidden xl:table-cell">{money(t.labourCost)}</td>
                  <td className="px-2 xl:px-3 py-2 text-right whitespace-nowrap text-slate-700 dark:text-slate-200 hidden xl:table-cell">{money(t.otherCost)}</td>
                  <td className="px-2 xl:px-3 py-2 text-right whitespace-nowrap text-slate-700 dark:text-slate-200 xl:hidden">{money(t.cost)}</td>
                  <td className={`px-2 xl:px-3 py-2 text-right whitespace-nowrap ${profitTone(t.profit)}`}>
                    {money(t.profit)}
                    {t.margin != null && <span className="xl:hidden text-[10px] font-medium text-slate-400"> {t.margin}%</span>}
                  </td>
                  <td className="px-2 xl:px-3 py-2 text-right whitespace-nowrap text-slate-500 dark:text-slate-400 hidden xl:table-cell">{pctText(t.margin)}</td>
                  <td className="px-2 xl:px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{t.unpaid ? `${t.unpaid} owing` : ''}</td>
                </tr>
              </tfoot>
            </table>

            {/* Cards below lg. The total row repeats the cards' three
                centred columns so each total sits under its figure. */}
            <ul className="lg:hidden divide-y divide-slate-200/70 dark:divide-slate-700/60">
              {pnl.rows.map((r) => (
                <li key={r.key} className="px-3 py-3 bg-white dark:bg-slate-900/30">
                  <div className="flex items-center justify-between gap-2">
                    <WorkOrderChip repairId={r.job_id} requestNumber={r.request_number} />
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatYmd(r.day)}</span>
                  </div>
                  <p className="mt-1.5 font-bold text-slate-900 dark:text-white uppercase truncate">{r.customer}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase truncate">{r.label}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div><span className="block text-[10px] uppercase tracking-wider text-slate-400">Revenue</span><span className="block text-sm font-bold text-slate-900 dark:text-white">{money(r.revenue)}</span></div>
                    <div><span className="block text-[10px] uppercase tracking-wider text-slate-400">Cost</span><span className="block text-sm font-bold text-slate-700 dark:text-slate-200">{money(r.cost)}</span></div>
                    <div><span className="block text-[10px] uppercase tracking-wider text-slate-400">Profit</span><span className={`block text-sm font-bold ${profitTone(r.profit)}`}>{money(r.profit)}{r.margin != null ? <span className="text-[10px] font-medium text-slate-400"> {r.margin}%</span> : null}</span></div>
                  </div>
                  <div className="mt-1.5"><PaymentCell row={r} /></div>
                </li>
              ))}
              <li className="px-3 py-3 bg-slate-50 dark:bg-slate-800/80">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total · {t.count} repair{t.count === 1 ? '' : 's'}{t.unpaid ? ` · ${t.unpaid} owing` : ''}
                </p>
                <div className="mt-1 grid grid-cols-3 gap-2 text-center text-sm font-bold">
                  <span className="text-slate-900 dark:text-white">{money(t.revenue)}</span>
                  <span className="text-slate-700 dark:text-slate-200">{money(t.cost)}</span>
                  <span className={profitTone(t.profit)}>{money(t.profit)}{t.margin != null ? <span className="text-[10px] font-medium text-slate-400"> {t.margin}%</span> : null}</span>
                </div>
              </li>
            </ul>
          </>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
        A repair counts on the day its tool was marked Completed, with the figures from its work order&rsquo;s accounting block. A job with several tools gets one row per tool; expenses logged against the whole job ride with the tool completed last.
        {settings && settings.labourCostRate == null && ' Labour cost uses each technician’s agreed terms; the shop-wide rate is not set (Admin Settings → Repair Tracker).'}
        {t?.uncostedParts ? ` ${t.uncostedParts} part${t.uncostedParts === 1 ? '' : 's'} carry no cost in the parts library, so parts cost trails parts charged.` : ''}
      </p>
    </div>
  );
}
