import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { accountingAPI, staffAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import { useSettings } from '../../contexts/SettingsContext';
import TabHeader from '../sales/TabHeader';
import { BTN_NEUTRAL, FILTER_INPUT } from '../sales/ui';
import { formatMoney } from '../../utils/money';
import { formatYmd } from '../../utils/dateFormat';
import { profitTone } from '../../utils/jobAccounting';
import { journalEntries, pnlRows, presetRange, shopTime, toCsv, downloadCsv, csvMoney, JOURNAL_KINDS, JOURNAL_FILTERS } from '../../utils/accounting';
import PeriodPicker from './PeriodPicker';
import StatTile, { StatRow } from './StatTile';
import WorkOrderChip from './WorkOrderChip';
import { openPrintDayClose, openCloseTab, isMobile } from './PrintDayClose';

const money = (n) => (n == null ? '—' : formatMoney(n));
// The search box is full width until xl (it shares the chip row only
// there), so the width is swapped out of FILTER_INPUT rather than appended —
// a later `w-full` would lose to the `sm:w-auto` already in it.
const SEARCH_INPUT = FILTER_INPUT.replace('w-full sm:w-auto', 'w-full xl:w-auto');

// A bill or payment pill: opens the record in Cash Flow (the section
// switches to Money Out / Money In on the deep link).
function RefChip({ item }) {
  if (!item?.id || !item.number) return null;
  if (item.type === 'wo') return <WorkOrderChip repairId={item.id} requestNumber={item.number} />;
  const param = item.type === 'bill' ? 'bill' : 'payment';
  return (
    <Link
      to={`/workspace?section=cash-flow&${param}=${item.id}`}
      title={`Open ${item.number}`}
      className="relative before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[''] sm:before:hidden inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-slate-200/70 hover:bg-slate-300/70 dark:bg-slate-700/60 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
    >
      <span className="material-symbols-outlined text-sm">{item.type === 'bill' ? 'receipt_long' : 'payments'}</span>
      {item.number}
    </Link>
  );
}

function longDay(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

const amountText = (e) => {
  if (e.amount == null) return '';
  if (e.direction === 'in') return `+${formatMoney(e.amount, e.currency)}`;
  if (e.direction === 'out') return `−${formatMoney(e.amount, e.currency)}`;
  return formatMoney(e.amount, e.currency);
};
const amountTone = (e) => (e.direction === 'in' ? 'text-green-700 dark:text-green-400'
  : e.direction === 'out' ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200');

/**
 * Money journal (admin only): every money event in the period in one
 * chronological list — invoices issued, repairs completed, payments
 * received, bills logged and paid, and the edits that touched money — with
 * a running cash balance (received minus paid). Derived from the records
 * each time, never stored.
 */
export default function JournalView({ focusTick }) {
  const showToast = useToast();
  const { settings } = useSettings();
  const [range, setRange] = useState(() => ({ preset: 'today', ...presetRange('today') }));
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async (withSpinner) => {
    if (withSpinner) setLoading(true);
    try {
      setData(await accountingAPI.journal(range.from, range.to));
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to load the journal.'));
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, [range.from, range.to, showToast]);

  useEffect(() => { load(true); }, [load]);
  useEffect(() => {
    if (focusTick > 0) load(false);
  }, [focusTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const opts = useMemo(() => ({
    from: range.from, to: range.to, gstRate: settings?.gstRate, pstRate: settings?.pstRate,
  }), [range.from, range.to, settings?.gstRate, settings?.pstRate]);
  const journal = useMemo(() => (data ? journalEntries(data, opts) : null), [data, opts]);
  const single = range.from === range.to;

  const counts = useMemo(() => {
    const c = {};
    for (const f of JOURNAL_FILTERS) c[f.id] = f.kinds ? (journal?.entries || []).filter((e) => f.kinds.includes(e.kind)).length : journal?.entries.length || 0;
    return c;
  }, [journal]);

  const visible = useMemo(() => {
    if (!journal) return [];
    const kinds = JOURNAL_FILTERS.find((f) => f.id === filter)?.kinds;
    const needle = q.trim().toLowerCase();
    return journal.entries.filter((e) => (!kinds || kinds.includes(e.kind))
      && (!needle || [e.title, e.sub, e.ref?.number, e.wo?.number, e.actor?.name].some((s) => (s || '').toLowerCase().includes(needle))));
  }, [journal, filter, q]);

  const exportCsv = () => {
    if (!journal) return;
    const columns = [
      { label: 'Date', value: 'day' },
      { label: 'Time', value: (e) => shopTime(e.ts) },
      { label: 'Event', value: (e) => JOURNAL_KINDS[e.kind]?.label || e.kind },
      { label: 'Description', value: 'title' },
      { label: 'Details', value: (e) => e.sub || '' },
      { label: 'Reference', value: (e) => e.ref?.number || '' },
      { label: 'Work order', value: (e) => (e.ref?.type === 'wo' ? e.ref.number : e.wo?.number || '') },
      { label: 'Amount', value: (e) => csvMoney(e.amount) },
      { label: 'Direction', value: 'direction' },
      { label: 'Currency', value: (e) => e.currency || 'CAD' },
      { label: 'Who', value: (e) => e.actor?.name || '' },
      { label: 'Cash balance', value: (e) => csvMoney(e.balance) },
    ];
    downloadCsv(`money-journal-${range.from}${single ? '' : `-to-${range.to}`}.csv`, toCsv(columns, visible));
  };

  const printClose = async () => {
    if (!journal) return;
    const win = isMobile() ? openCloseTab() : null;
    if (isMobile() && !win) { showToast('error', 'Allow pop-ups to print from a phone.'); return; }
    setPrinting(true);
    try {
      const [p, staff] = await Promise.all([accountingAPI.pnl(range.from, range.to), staffAPI.list().catch(() => [])]);
      const technicianRates = {};
      for (const a of staff) {
        if (a.labour_cost_rate != null) technicianRates[a.name] = { basis: a.labour_cost_basis || 'hourly', rate: a.labour_cost_rate };
      }
      const pnl = pnlRows(p, { ...opts, labourCostRate: settings?.labourCostRate, technicianRates });
      await openPrintDayClose({ from: range.from, to: range.to, pnl, journal, win });
    } catch (err) {
      if (win) win.close();
      showToast('error', apiErrorMessage(err, 'Failed to build the close.'));
    } finally {
      setPrinting(false);
    }
  };

  const t = journal?.totals;
  let lastDay = null;

  return (
    <div>
      {/* Same toolbar recipe as the bills and payments lists: the period on
          the left, the actions on the right; phones get the period full
          width with the two buttons split beneath it. */}
      <TabHeader>
        <PeriodPicker value={range} onChange={setRange} className="col-span-2" />
        <button type="button" onClick={exportCsv} disabled={!visible.length} className={`${BTN_NEUTRAL} min-h-11 sm:min-h-0 sm:ml-auto disabled:opacity-50`} title="Download the listed entries as a spreadsheet">
          <span className="material-symbols-outlined text-base">download</span>
          Export CSV
        </button>
        <button type="button" onClick={printClose} disabled={!journal || printing} className={`${BTN_NEUTRAL} min-h-11 sm:min-h-0 disabled:opacity-50`} title="Print the profit and loss with this journal">
          <span className="material-symbols-outlined text-base">print</span>
          {printing ? 'Preparing…' : single ? 'Print day close' : 'Print period close'}
        </button>
      </TabHeader>

      <StatRow className="mb-4">
        <StatTile label="Invoiced" sub="pre-tax, issued">{money(t?.billed)}</StatTile>
        <StatTile label="Received" sub="customer payments" tone="text-green-700 dark:text-green-400">{money(t?.received)}</StatTile>
        <StatTile label="Bills logged" sub="supplier bills">{money(t?.owed)}</StatTile>
        <StatTile label="Bills paid" sub="cash out">{money(t?.paid)}</StatTile>
        <StatTile label="Net cash" sub="received − paid" tone={profitTone(t?.net)}>{money(t?.net)}</StatTile>
      </StatRow>

      {/* List filters sit right on the list they narrow. The chips wrap like
          the bills chips do (a sideways scroll hides the ones off screen);
          the search has its own row until xl, where the six chips and the
          box first fit one line, and then keeps the right end of it. */}
      <div className="flex flex-col xl:flex-row xl:flex-wrap xl:items-center gap-2 mb-3">
        <div className="flex flex-wrap gap-1.5 min-w-0 xl:flex-1">
          {JOURNAL_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 min-h-11 sm:min-h-0 rounded-full text-xs font-bold border transition-colors ${
                filter === f.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {f.label}
              <span className={filter === f.id ? 'text-white/80' : 'text-slate-400'}>· {counts[f.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search WO, bill, payment, customer, who…"
          aria-label="Search the journal"
          className={`${SEARCH_INPUT} xl:ml-auto xl:min-w-[240px]`}
        />
      </div>

      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
        {loading && !journal ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined animate-spin text-slate-400 text-3xl">progress_activity</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 px-4 text-slate-500 dark:text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block text-slate-300 dark:text-slate-600">menu_book</span>
            <p className="font-bold">{journal?.entries.length ? 'Nothing matches the filter.' : `No money events ${single ? 'on this day' : 'in this period'}.`}</p>
            <p className="text-sm mt-1">Invoices issued, repairs completed, payments, bills and money edits land here as they happen.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200/70 dark:divide-slate-700/60">
            {visible.map((e) => {
              const kind = JOURNAL_KINDS[e.kind] || { label: e.kind, icon: 'circle', tone: '' };
              const dayHeader = !single && e.day !== lastDay;
              lastDay = e.day;
              return (
                <li key={`${e.kind}-${e.ref?.id || ''}-${e.ts}-${e.title}`} className="bg-white dark:bg-slate-900/30">
                  {dayHeader && (
                    <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-700/60">
                      {longDay(e.day)}
                    </div>
                  )}
                  {/* One line per entry from lg; narrower columns (phones, and
                      tablets beside the rail) put the time, the kind and the
                      amount on the first line and the text underneath. */}
                  <div className="px-3 py-2.5 flex flex-wrap lg:flex-nowrap items-start gap-x-3 gap-y-1.5">
                    <span className="w-16 flex-shrink-0 text-xs text-slate-500 dark:text-slate-400 pt-1 font-mono">{shopTime(e.ts)}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${kind.tone}`}>
                      <span className="material-symbols-outlined text-sm">{kind.icon}</span>
                      {kind.label}
                    </span>
                    <div className="min-w-0 flex-1 basis-full lg:basis-auto order-last lg:order-none">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{e.title}</p>
                      {e.sub && <p className="text-xs text-slate-500 dark:text-slate-400">{e.sub}</p>}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <RefChip item={e.ref} />
                        {e.wo && <RefChip item={e.wo} />}
                        {e.actor?.name && <span className="text-[11px] text-slate-400 dark:text-slate-500">by {e.actor.name}</span>}
                      </div>
                    </div>
                    <div className="ml-auto text-right flex-shrink-0">
                      <span className={`block text-sm font-bold whitespace-nowrap ${amountTone(e)}`}>{amountText(e)}</span>
                      {e.kind === 'invoice' && e.inclTax != null && <span className="block text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{formatMoney(e.inclTax)} incl. tax</span>}
                      {(e.direction === 'in' || e.direction === 'out') && <span className="hidden lg:block text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">cash {formatMoney(e.balance)}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
        Cash balance runs from the start of the period: payments received minus bills paid. Invoices and bills logged are shown but not counted as cash until paid.
        {t && !single ? ` ${journal.entries.length} entries from ${formatYmd(range.from)} to ${formatYmd(range.to)}.` : ''}
      </p>
    </div>
  );
}
