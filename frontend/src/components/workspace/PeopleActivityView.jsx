import { useState, useEffect, useCallback, useMemo } from 'react';
import { activityAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import TabHeader from '../sales/TabHeader';
import { BTN_NEUTRAL, FILTER_INPUT } from '../sales/ui';
import { formatYmd } from '../../utils/dateFormat';
import { presetRange, toCsv, downloadCsv } from '../../utils/accounting';
import { ACTIVITY_GROUPS, activityKind } from '../../constants/activity';
import PeriodPicker from './PeriodPicker';
import StaffAvatar from './StaffAvatar';
import WorkOrderChip from './WorkOrderChip';
import CashFlowChip from './CashFlowChip';
import { openPrintActivityReport, openReportTab, isMobile } from './PrintActivityReport';

const ROLE_LABELS = { admin: 'Admin', staff: 'Staff', technician: 'Technician' };
// [count key, label, admin only]
const COUNT_CARDS = [
  ['jobs_created', 'WOs opened', false],
  ['tools_received', 'Tools in', false],
  ['status_changes', 'Status changes', false],
  ['completed', 'Completed', false],
  ['tasks_completed', 'Tasks done', false],
  ['edits', 'Edits', false],
  ['library', 'Parts library', false],
  ['money', 'Cash flow', true],
  ['admin', 'Admin', true],
];

function longDay(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

function PersonCard({ person, selected, onSelect, isAdmin }) {
  const c = person.counts;
  const cards = COUNT_CARDS.filter(([key, , adminOnly]) => (!adminOnly || isAdmin) && (c[key] > 0 || ['jobs_created', 'status_changes', 'tasks_completed'].includes(key)));
  return (
    <button
      type="button"
      onClick={() => onSelect(person)}
      aria-pressed={selected}
      className={`text-left rounded-xl border p-3 transition-colors min-h-[44px] ${
        selected
          ? 'border-primary bg-primary/5 dark:bg-primary/10'
          : 'border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800'
      } ${!person.is_active ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <StaffAvatar userId={person.user_id} name={person.name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 dark:text-white truncate">{person.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {ROLE_LABELS[person.role] || person.role}{!person.is_active ? ' · deactivated' : ''}
            {person.last ? ` · last ${formatYmd(person.last.day)} ${person.last.time}` : ' · nothing in this period'}
          </p>
        </div>
        <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">{c.total}</span>
      </div>
      {cards.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {cards.map(([key, label]) => (
            <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
              <span className="text-slate-900 dark:text-white">{c[key]}</span>{label}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

/**
 * People (Workspace → Calendar → People): the period's happenings grouped by
 * who did them. Admins see every shop account; anyone else sees only their
 * own card. Pick a person for their timeline, printable and exportable.
 */
export default function PeopleActivityView({ currentUser }) {
  const showToast = useToast();
  const isAdmin = currentUser?.role === 'admin';
  const [range, setRange] = useState(() => ({ preset: 'week', ...presetRange('week') }));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [q, setQ] = useState('');
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await activityAPI.people({ from: range.from, to: range.to });
      setData(res);
      // Keep the chosen person across range changes; non-admins only ever have themselves.
      setSelected((prev) => res.people.find((p) => p.user_id === prev?.user_id) || (!isAdmin ? res.people[0] || null : prev && null));
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to load the activity by person.'));
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, isAdmin, showToast]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selected) { setTimeline(null); return undefined; }
    let alive = true;
    setTimelineLoading(true);
    activityAPI.list({ from: range.from, to: range.to, actor: selected.user_id })
      .then((res) => { if (alive) setTimeline(res); })
      .catch((err) => { if (alive) showToast('error', apiErrorMessage(err, 'Failed to load that person’s activity.')); })
      .finally(() => { if (alive) setTimelineLoading(false); });
    return () => { alive = false; };
  }, [selected?.user_id, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const events = useMemo(() => {
    const list = timeline?.events || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((e) => [e.summary, e.request_number, e.tool, ...(e.details || [])].some((s) => (s || '').toLowerCase().includes(needle)));
  }, [timeline, q]);

  const single = range.from === range.to;
  const rangeText = single ? formatYmd(range.from) : `${formatYmd(range.from)} – ${formatYmd(range.to)}`;

  const exportCsv = () => {
    if (!selected || !events.length) return;
    const columns = [
      { label: 'Date', value: 'day' },
      { label: 'Time', value: 'time' },
      { label: 'Event', value: (e) => activityKind(e.kind).label },
      { label: 'What happened', value: 'summary' },
      { label: 'Details', value: (e) => (e.details || []).join('; ') },
      { label: 'Work order', value: (e) => e.request_number || '' },
      { label: 'Tool', value: (e) => e.tool || '' },
      { label: 'Who', value: (e) => e.actor?.name || '' },
    ];
    downloadCsv(`activity-${selected.name.replace(/\s+/g, '-').toLowerCase()}-${range.from}${single ? '' : `-to-${range.to}`}.csv`, toCsv(columns, events));
  };

  const printTimeline = async () => {
    if (!selected || !timeline) return;
    const win = isMobile() ? openReportTab() : null;
    if (isMobile() && !win) { showToast('error', 'Allow pop-ups to print from a phone.'); return; }
    setPrinting(true);
    try {
      await openPrintActivityReport({ data: timeline, includeLog: true, generatedBy: currentUser?.name, subject: `Activity for ${selected.name}`, win });
    } catch (err) {
      win?.close();
      showToast('error', apiErrorMessage(err, 'Failed to print.'));
    } finally {
      setPrinting(false);
    }
  };

  const people = data?.people || [];
  let lastDay = null;

  return (
    <div>
      <TabHeader
        title="People"
        subtitle={isAdmin ? 'What each person did — pick someone for their timeline' : 'What you did in the period'}
      >
        <div className="col-span-2 sm:col-span-1"><PeriodPicker value={range} onChange={setRange} /></div>
      </TabHeader>

      {loading && !data ? (
        <div className="text-center py-16">
          <span className="material-symbols-outlined animate-spin text-slate-400 text-3xl">progress_activity</span>
        </div>
      ) : people.length === 0 ? (
        <div className="text-center py-16 px-4 text-slate-500 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-700/60">
          <span className="material-symbols-outlined text-4xl mb-2 block text-slate-300 dark:text-slate-600">groups</span>
          <p className="font-bold">No shop accounts to show.</p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-[11px] text-slate-400 dark:text-slate-500">
            {rangeText} · {data.events_total} happening{data.events_total === 1 ? '' : 's'} recorded
            {isAdmin && data.unattributed > 0 ? ` · ${data.unattributed} without a name (before mid-September 2026, or automatic)` : ''}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mb-5">
            {people.map((p) => (
              <PersonCard key={p.user_id} person={p} isAdmin={isAdmin} selected={selected?.user_id === p.user_id} onSelect={(person) => setSelected(selected?.user_id === person.user_id && isAdmin ? null : person)} />
            ))}
          </div>
        </>
      )}

      {selected && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <StaffAvatar userId={selected.user_id} name={selected.name} size="sm" />
              <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{selected.name}</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{events.length} happening{events.length === 1 ? '' : 's'}{q ? ' matching' : ''}</span>
            </div>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this timeline…" aria-label="Search this timeline" className={`${FILTER_INPUT} sm:w-56`} />
            <div className="grid grid-cols-2 sm:flex gap-2">
              <button type="button" onClick={exportCsv} disabled={!events.length} className={`${BTN_NEUTRAL} min-h-11 sm:min-h-0 disabled:opacity-50`}>
                <span className="material-symbols-outlined text-base">download</span>CSV
              </button>
              <button type="button" onClick={printTimeline} disabled={!timeline || printing} className={`${BTN_NEUTRAL} min-h-11 sm:min-h-0 disabled:opacity-50`}>
                <span className="material-symbols-outlined text-base">print</span>{printing ? 'Preparing…' : 'Print'}
              </button>
            </div>
          </div>
          {timelineLoading && !timeline ? (
            <div className="text-center py-12"><span className="material-symbols-outlined animate-spin text-slate-400 text-2xl">progress_activity</span></div>
          ) : events.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500 italic">
              {q ? 'Nothing matches the search.' : `Nothing recorded for ${selected.name} in this period.`}
            </p>
          ) : (
            <ol className="divide-y divide-slate-200/70 dark:divide-slate-700/60">
              {events.map((e, i) => {
                const kind = activityKind(e.kind);
                const group = ACTIVITY_GROUPS[kind.group] || ACTIVITY_GROUPS.edits;
                const dayHeader = !single && e.day !== lastDay;
                lastDay = e.day;
                return (
                  <li key={`${e.ts}-${i}`} className="bg-white dark:bg-slate-900/30">
                    {dayHeader && (
                      <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-700/60">
                        {longDay(e.day)}
                      </div>
                    )}
                    <div className="flex gap-2.5 px-4 py-2.5">
                      <span className="w-14 flex-shrink-0 pt-0.5 text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{e.time}</span>
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${group.chip}`} title={kind.label}>
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">{kind.icon}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-slate-900 dark:text-white break-words">{e.summary}</span>
                        {e.details?.length > 0 && <span className="block text-xs text-slate-500 dark:text-slate-400 break-words">{e.details.join('; ')}</span>}
                        {(e.job_id && e.request_number) || ((e.bill_id || e.payment_id) && !String(e.kind).endsWith('_deleted')) ? (
                          <span className="mt-1 flex items-center gap-2 flex-wrap">
                            {e.job_id && e.request_number && <WorkOrderChip repairId={e.job_id} requestNumber={e.request_number} />}
                            {(e.bill_id || e.payment_id) && !String(e.kind).endsWith('_deleted') && (
                              <CashFlowChip billId={e.bill_id} paymentId={e.payment_id} number={e.bill_number || e.payment_number} />
                            )}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
