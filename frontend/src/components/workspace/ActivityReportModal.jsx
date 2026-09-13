import { useState } from 'react';
import { activityAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import useEscapeClose from '../../utils/useEscapeClose';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import { getTodayPacific, formatYmd } from '../../utils/dateFormat';
import { openPrintActivityReport, openReportTab, rangeLabel, isMobile } from './PrintActivityReport';

// Plain calendar-day math on YYYY-MM-DD strings; the anchor is the shop's
// "today" so the presets agree with the calendar grid and the backend.
const toYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromYmd = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (ymd, n) => { const d = fromYmd(ymd); d.setDate(d.getDate() + n); return toYmd(d); };
const daysBetween = (from, to) => Math.round((fromYmd(to) - fromYmd(from)) / 86400000) + 1;

// Weeks run Sunday–Saturday, matching the calendar grid.
function presetRange(preset, today) {
  const t = fromYmd(today);
  switch (preset) {
    case 'today': return [today, today];
    case 'yesterday': { const y = addDays(today, -1); return [y, y]; }
    case 'this_week': { const start = addDays(today, -t.getDay()); return [start, addDays(start, 6)]; }
    case 'last_week': { const start = addDays(today, -t.getDay() - 7); return [start, addDays(start, 6)]; }
    case 'this_month': return [toYmd(new Date(t.getFullYear(), t.getMonth(), 1)), toYmd(new Date(t.getFullYear(), t.getMonth() + 1, 0))];
    case 'last_month': return [toYmd(new Date(t.getFullYear(), t.getMonth() - 1, 1)), toYmd(new Date(t.getFullYear(), t.getMonth(), 0))];
    case 'this_year': return [`${t.getFullYear()}-01-01`, `${t.getFullYear()}-12-31`];
    case 'last_year': return [`${t.getFullYear() - 1}-01-01`, `${t.getFullYear() - 1}-12-31`];
    default: return [today, today];
  }
}

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
  { value: 'last_year', label: 'Last year' },
  { value: 'custom', label: 'Custom range…' },
];

// Past this many days the line-by-line log is off by default — a year of
// rows is hundreds of pages; the summary + month table is the useful part.
const LOG_DEFAULT_MAX_DAYS = 62;

const inputCls = 'w-full px-3 py-2 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all';

/**
 * Pick a period (day / week / month / year / custom) and print the activity
 * report for it. Loads the data on demand so the calendar never pays for a
 * year of events it isn't showing.
 */
export default function ActivityReportModal({ currentUser, initialFrom, initialTo, onClose }) {
  const showToast = useToast();
  const today = getTodayPacific();
  const initial = initialFrom && initialTo ? [initialFrom, initialTo] : presetRange('today', today);
  const [preset, setPreset] = useState(initialFrom && initialTo ? 'custom' : 'today');
  const [from, setFrom] = useState(initial[0]);
  const [to, setTo] = useState(initial[1]);
  const [includeLog, setIncludeLog] = useState(daysBetween(initial[0], initial[1]) <= LOG_DEFAULT_MAX_DAYS);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(null); // { from, to, data }
  useEscapeClose(onClose);
  useBodyScrollLock(true);

  const applyRange = (nextFrom, nextTo) => {
    setFrom(nextFrom);
    setTo(nextTo);
    setLoaded(null);
    if (nextFrom && nextTo && nextTo >= nextFrom) {
      setIncludeLog(daysBetween(nextFrom, nextTo) <= LOG_DEFAULT_MAX_DAYS);
    }
  };

  const choosePreset = (value) => {
    setPreset(value);
    if (value !== 'custom') {
      const [f, t] = presetRange(value, today);
      applyRange(f, t);
    }
  };

  const rangeValid = !!from && !!to && to >= from;
  const days = rangeValid ? daysBetween(from, to) : 0;

  const load = async () => {
    const data = await activityAPI.list({ from, to });
    setLoaded({ from, to, data });
    return data;
  };

  const handlePreview = async () => {
    if (!rangeValid || busy) return;
    setBusy(true);
    try { await load(); } catch (err) { showToast('error', apiErrorMessage(err, 'Failed to load the activity for that period.')); }
    finally { setBusy(false); }
  };

  const handlePrint = async () => {
    if (!rangeValid || busy) return;
    // On phones the tab must be opened inside the tap, before any await —
    // see openReportTab. It is filled in once the data lands.
    const win = isMobile() ? openReportTab() : null;
    if (isMobile() && !win) {
      showToast('error', 'Your browser blocked the report tab. Allow pop-ups for this site and try again.');
      return;
    }
    setBusy(true);
    try {
      const data = loaded && loaded.from === from && loaded.to === to ? loaded.data : await load();
      // Resolves when the print dialog closes (printed or cancelled) — the
      // job is done either way, so the dialog gets out of the way itself.
      await openPrintActivityReport({ data, includeLog, generatedBy: currentUser?.name, win });
      onClose();
      return;
    } catch (err) {
      win?.close();
      showToast('error', apiErrorMessage(err, 'Failed to load the activity for that period.'));
    } finally {
      setBusy(false);
    }
  };

  const summary = loaded?.data?.summary;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Print activity report</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Who did what — tools in, status changes, tasks, edits</p>
          </div>
          <button onClick={onClose} className="p-2 -m-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="activity-report-preset" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Period</label>
            <select id="activity-report-preset" value={preset} onChange={(e) => choosePreset(e.target.value)} className={inputCls}>
              {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="activity-report-from" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">From</label>
                <input id="activity-report-from" type="date" value={from} max={to || undefined} onChange={(e) => applyRange(e.target.value, to)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="activity-report-to" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">To</label>
                <input id="activity-report-to" type="date" value={to} min={from || undefined} onChange={(e) => applyRange(from, e.target.value)} className={inputCls} />
              </div>
            </div>
          )}

          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Range</span>
              <span className="font-bold text-slate-900 dark:text-white text-right">
                {rangeValid ? rangeLabel(from, to) : '—'}
                {rangeValid && <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{days} day{days === 1 ? '' : 's'}</span>}
              </span>
            </div>
            {summary && (
              <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/60 grid grid-cols-3 gap-2 text-center">
                {[
                  [summary.tools_received, 'Tools in'],
                  [summary.status_changes, 'Status changes'],
                  [summary.tasks_completed, 'Tasks done'],
                  [summary.transitions?.ready || 0, 'Ready'],
                  [summary.transitions?.completed || 0, 'Completed'],
                  [loaded.data.events.length, 'All events'],
                ].map(([n, label]) => (
                  <div key={label}>
                    <div className="text-lg font-black text-slate-900 dark:text-white leading-tight">{n}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeLog}
              onChange={(e) => setIncludeLog(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/50 bg-white dark:bg-slate-700"
            />
            <span>
              Include the line-by-line daily log
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {days > LOG_DEFAULT_MAX_DAYS
                  ? 'Long range — the summary and month-by-month table print either way; the full log can run to many pages.'
                  : 'Every happening in the period, grouped by day, with who did it.'}
              </span>
            </span>
          </label>

          {/* Phones stack the pair (Print last = thumb-nearest); sm+ is the
              side-by-side row. Both hold 44px on touch widths. */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={handlePreview}
              disabled={busy || !rangeValid}
              className="w-full sm:w-auto min-h-11 sm:min-h-0 px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl transition-colors text-sm disabled:opacity-50"
            >
              {busy && !loaded ? 'Loading…' : 'Preview counts'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={busy || !rangeValid}
              className="w-full sm:w-auto sm:flex-1 min-h-11 sm:min-h-0 inline-flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-blue-500 text-white font-black rounded-xl transition-colors text-sm uppercase disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">print</span>
              {busy ? 'Opening print…' : 'Print report'}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Days are shop-local. Who-did-what is recorded from {formatYmd('2026-09-13')} onward; earlier status changes print without a name.
          </p>
        </div>
      </div>
    </div>
  );
}
