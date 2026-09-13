import { useState, useEffect, useCallback, useMemo } from 'react';
import { tasksAPI, activityAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import usePollWhileVisible from '../../utils/usePollWhileVisible';
import TabHeader from '../sales/TabHeader';
import { BTN_NEUTRAL, BTN_PRIMARY, ICON_BTN } from '../sales/ui';
import { TASK_PRIORITIES } from '../../constants/workspace';
import { ACTIVITY_GROUPS, ACTIVITY_GROUP_ORDER, activityKind, countByGroup } from '../../constants/activity';
import { getTodayPacific, formatYmd } from '../../utils/dateFormat';
import useEscapeClose from '../../utils/useEscapeClose';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import StaffAvatar from './StaffAvatar';
import WorkOrderChip from './WorkOrderChip';
import TaskFormModal from './TaskFormModal';
import TaskDetailModal from './TaskDetailModal';
import ActivityReportModal from './ActivityReportModal';

const POLL_MS = 60000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS = 3;
// Below Tailwind's `sm` (640px) a cell is ~35-45px wide — too narrow for
// separate chip / "+N more" targets — so a tap on the cell opens the day's
// list instead, and that list carries the Add-task button.
const isPhone = () => window.matchMedia('(max-width: 639px)').matches;

// 42 cells (6 weeks) starting on the Sunday on/before the 1st — plain local
// Date math over calendar days; no timezones can shift anything.
function monthMatrix(year, month) {
  const firstDow = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - firstDow + i);
    cells.push({
      ymd: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
    });
  }
  return cells;
}

function TaskChip({ task, onClick }) {
  const priority = TASK_PRIORITIES[task.priority] || TASK_PRIORITIES.normal;
  const done = task.status === 'done';
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(task); }}
      title={task.title}
      className={`w-full flex items-center gap-1 px-1.5 py-1 rounded-md text-left text-[11px] font-bold border truncate transition-all hover:shadow-sm ${priority.color} ${done ? 'opacity-50' : ''}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priority.dot}`} />
      <span className={`truncate ${done ? 'line-through' : ''}`}>{task.title}</span>
    </button>
  );
}

/**
 * One day, two halves: the tasks due that day and the day's recorded
 * happenings (who did what, oldest first). Opened from a cell's "+N more"
 * or its activity chips.
 */
function DayModal({ ymd, tasks, activity, onOpenTask, onAddTask, onClose }) {
  useEscapeClose(onClose);
  useBodyScrollLock(true);
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{formatYmd(ymd)}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {tasks.length} task{tasks.length === 1 ? '' : 's'} due · {activity.length} happening{activity.length === 1 ? '' : 's'}
            </p>
          </div>
          <button onClick={onClose} className="w-11 h-11 -m-2 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {/* dvh, not vh: iOS reports the large viewport for vh, so a 70vh box
            plus the pt-10 offset and header ran off short phones and left the
            list's tail scrolling below the fold. */}
        <div className="p-4 space-y-5 max-h-[calc(100dvh-11rem)] overflow-y-auto">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Tasks due</h3>
            {tasks.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">No tasks due this day.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onOpenTask(task)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary/50 text-left transition-colors"
                  >
                    <span className="min-w-0">
                      <span className={`block text-sm font-bold text-slate-900 dark:text-white truncate ${task.status === 'done' ? 'line-through opacity-60' : ''}`}>
                        {task.title}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                        {(TASK_PRIORITIES[task.priority] || TASK_PRIORITIES.normal).label}
                        {task.assignee_name ? ` · ${task.assignee_name}` : ' · Unassigned'}
                      </span>
                    </span>
                    {task.assignee_id && <StaffAvatar userId={task.assignee_id} name={task.assignee_name} size="sm" />}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => onAddTask(ymd)}
              className={`${BTN_PRIMARY} w-full mt-3 min-h-11`}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">add_task</span>
              Add task
            </button>
          </section>
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">What happened</h3>
            {activity.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">Nothing recorded for this day.</p>
            ) : (
              <ol className="space-y-1.5">
                {activity.map((e, i) => {
                  const kind = activityKind(e.kind);
                  const group = ACTIVITY_GROUPS[kind.group];
                  return (
                    <li key={`${e.ts}-${i}`} className="flex gap-2.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="w-14 flex-shrink-0 pt-0.5 text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{e.time}</span>
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${group.chip}`} title={kind.label}>
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">{kind.icon}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-slate-900 dark:text-white break-words">{e.summary}</span>
                        {e.details?.length > 0 && (
                          <span className="block text-xs text-slate-500 dark:text-slate-400 break-words">{e.details.join('; ')}</span>
                        )}
                        <span className="mt-1 flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                          {e.actor?.name ? (
                            <span className="inline-flex items-center gap-1">
                              <StaffAvatar userId={e.actor.user_id || e.actor.name} name={e.actor.name} size="sm" />
                              {e.actor.name}
                            </span>
                          ) : (
                            <span className="italic">no name recorded</span>
                          )}
                          {e.job_id && e.request_number && (
                            <WorkOrderChip repairId={e.job_id} requestNumber={e.request_number} />
                          )}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * Google Calendar-style month grid: tasks sit on their due dates, coloured by
 * priority. Click an empty day to add a task due that day; click a chip for
 * its details.
 */
export default function TaskCalendar({ currentUser, staff, refreshCounts, focusTick }) {
  const showToast = useToast();
  const todayYmd = getTodayPacific();
  const [yearMonth, setYearMonth] = useState(() => {
    const [y, m] = todayYmd.split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(true);
  const [detailTask, setDetailTask] = useState(null);
  const [createForDate, setCreateForDate] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [dayModal, setDayModal] = useState(null);
  // Activity layer: what happened each day (tools in, status changes, tasks
  // done, edits) from GET /api/activity, keyed by shop-local day.
  const [activityByDay, setActivityByDay] = useState({});
  const [showActivity, setShowActivity] = useState(() => localStorage.getItem('ws_calendar_activity') !== '0');
  const [reportOpen, setReportOpen] = useState(false);

  const cells = useMemo(() => monthMatrix(yearMonth.year, yearMonth.month), [yearMonth]);

  const load = useCallback(async (withSpinner = false) => {
    if (withSpinner) setLoading(true);
    try {
      const { tasks: fetched } = await tasksAPI.list({
        due_from: cells[0].ymd,
        due_to: cells[41].ymd,
        status: showDone ? undefined : 'open',
        // The API rejects limit > 200 with a 422 — anything higher makes the
        // whole calendar load fail and the grid render empty.
        limit: 200,
        sort_by: 'priority',
        sort_dir: 'desc',
      });
      setTasks(fetched);
      try {
        const { events } = await activityAPI.list({ from: cells[0].ymd, to: cells[41].ymd });
        const map = {};
        for (const e of events) (map[e.day] = map[e.day] || []).push(e);
        setActivityByDay(map);
      } catch {
        // The activity layer is optional — tasks still render without it.
      }
    } catch {
      showToast('error', 'Failed to load the calendar.');
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, [cells, showDone, showToast]);

  useEffect(() => { load(true); }, [load]);

  // Sync: quiet interval refetch (visible tabs only) + focus catch-up.
  usePollWhileVisible(() => load(false), POLL_MS);
  useEffect(() => {
    if (focusTick > 0) load(false);
  }, [focusTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const afterMutation = () => { load(false); refreshCounts(); };

  const byDate = useMemo(() => {
    const map = {};
    for (const task of tasks) {
      if (!task.due_date) continue;
      (map[task.due_date] = map[task.due_date] || []).push(task);
    }
    return map;
  }, [tasks]);

  const shiftMonth = (delta) => {
    setYearMonth(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const goToday = () => {
    const [y, m] = todayYmd.split('-').map(Number);
    setYearMonth({ year: y, month: m - 1 });
  };

  const monthLabel = new Date(yearMonth.year, yearMonth.month, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div>
      <TabHeader
        title="Calendar"
        subtitle="Tasks by due date and what happened each day — click a day to add a task"
        action={(
          // Phones get two aligned full-width rows under the title: the three
          // toggles split evenly, then the month navigation with the label
          // centred between its arrows. From sm up `contents` dissolves the
          // rows back into the single beside-the-title toolbar.
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="flex gap-2 sm:contents">
              <button
                onClick={() => setReportOpen(true)}
                className={`${BTN_NEUTRAL} flex-1 sm:flex-none min-h-11 sm:min-h-0`}
                title="Print an activity report for a day, week, month or year"
              >
                <span className="material-symbols-outlined text-base">print</span>
                Report
              </button>
              <button
                onClick={() => setShowActivity((v) => { localStorage.setItem('ws_calendar_activity', v ? '0' : '1'); return !v; })}
                className={`${BTN_NEUTRAL} flex-1 sm:flex-none min-h-11 sm:min-h-0 ${showActivity ? '' : 'opacity-60'}`}
                title={showActivity ? 'Hide daily activity counts' : 'Show daily activity counts'}
                aria-pressed={showActivity}
              >
                <span className="material-symbols-outlined text-base">history</span>
                Activity
              </button>
              <button
                onClick={() => setShowDone((v) => !v)}
                className={`${BTN_NEUTRAL} flex-1 sm:flex-none min-h-11 sm:min-h-0 ${showDone ? '' : 'opacity-60'}`}
                title={showDone ? 'Hide completed tasks' : 'Show completed tasks'}
              >
                <span className="material-symbols-outlined text-base">{showDone ? 'visibility' : 'visibility_off'}</span>
                Done
              </button>
            </div>
            <div className="flex items-center gap-2 sm:contents">
              <button onClick={goToday} className={`${BTN_NEUTRAL} min-h-11 sm:min-h-0`}>Today</button>
              <button onClick={() => shiftMonth(-1)} className={`${ICON_BTN} min-w-11 min-h-11 sm:min-w-0 sm:min-h-0`} aria-label="Previous month">
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <span className="flex-1 sm:flex-none text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight whitespace-nowrap sm:min-w-[130px] text-center">
                {monthLabel}
              </span>
              <button onClick={() => shiftMonth(1)} className={`${ICON_BTN} min-w-11 min-h-11 sm:min-w-0 sm:min-h-0`} aria-label="Next month">
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      />

      {loading && tasks.length === 0 ? (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
          <p className="mt-3 text-slate-500 dark:text-slate-400">Loading calendar...</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700/60">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const dayTasks = byDate[cell.ymd] || [];
              const dayActivity = activityByDay[cell.ymd] || [];
              const activityCounts = countByGroup(dayActivity);
              const isToday = cell.ymd === todayYmd;
              const overflow = dayTasks.length - MAX_CHIPS;
              return (
                <div
                  key={cell.ymd}
                  onClick={() => (isPhone() ? setDayModal(cell.ymd) : setCreateForDate(cell.ymd))}
                  title={`Add a task due ${formatYmd(cell.ymd)}`}
                  className={`min-h-[92px] sm:min-h-[110px] p-1 sm:p-1.5 border-b border-r border-slate-200 dark:border-slate-700/60 [&:nth-child(7n)]:border-r-0 cursor-pointer transition-colors group ${
                    cell.inMonth
                      ? 'bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      : 'bg-slate-50/60 dark:bg-slate-900/70 text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                      isToday
                        ? 'bg-primary text-white ring-2 ring-primary/30'
                        : cell.inMonth
                          ? 'text-slate-700 dark:text-slate-300'
                          : 'text-slate-400 dark:text-slate-600'
                    }`}>
                      {cell.day}
                    </span>
                    <span className="material-symbols-outlined text-sm text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      add
                    </span>
                  </div>
                  <div className="hidden sm:block mt-1 space-y-1">
                    {dayTasks.slice(0, MAX_CHIPS).map((task) => (
                      <TaskChip key={task.id} task={task} onClick={setDetailTask} />
                    ))}
                    {overflow > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDayModal(cell.ymd); }}
                        className="w-full text-left px-1.5 py-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
                      >
                        +{overflow} more
                      </button>
                    )}
                  </div>
                  {/* Phones: a ~44px column leaves ~11px for a chip title, so
                      collapse the day's tasks into one tall tap target
                      (priority dots + count) that opens the day's list. */}
                  {dayTasks.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDayModal(cell.ymd); }}
                      aria-label={`${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'} due — open the day`}
                      className="sm:hidden mt-1 w-full min-h-[44px] flex flex-wrap content-start items-center gap-1 rounded-md text-left"
                    >
                      {dayTasks.slice(0, 4).map((task) => {
                        const p = TASK_PRIORITIES[task.priority] || TASK_PRIORITIES.normal;
                        return (
                          <span
                            key={task.id}
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${p.dot} ${task.status === 'done' ? 'opacity-40' : ''}`}
                          />
                        );
                      })}
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300">{dayTasks.length}</span>
                    </button>
                  )}
                  {/* Activity chips: one per group with its count. Click opens
                      the day's log; the task-add click on the cell is stopped. */}
                  {showActivity && dayActivity.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDayModal(cell.ymd); }}
                      title={`${dayActivity.length} happening${dayActivity.length === 1 ? '' : 's'} — open the day's log`}
                      className="mt-1 w-full flex flex-wrap gap-1 text-left"
                    >
                      {ACTIVITY_GROUP_ORDER.filter((g) => activityCounts[g]).map((g) => (
                        <span key={g} className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-bold leading-none ${ACTIVITY_GROUPS[g].chip}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: '11px' }} aria-hidden="true">{ACTIVITY_GROUPS[g].icon}</span>
                          {activityCounts[g]}
                        </span>
                      ))}
                      <span className="sr-only">
                        {ACTIVITY_GROUP_ORDER.filter((g) => activityCounts[g]).map((g) => `${activityCounts[g]} ${ACTIVITY_GROUPS[g].label}`).join(', ')}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {createForDate && (
        <TaskFormModal
          task={null}
          staff={staff}
          defaultAssigneeId={currentUser?.id}
          defaultDueDate={createForDate}
          onSaved={() => { setCreateForDate(null); afterMutation(); }}
          onClose={() => setCreateForDate(null)}
        />
      )}
      {editTask && (
        <TaskFormModal
          task={editTask}
          staff={staff}
          onSaved={() => { setEditTask(null); afterMutation(); }}
          onClose={() => setEditTask(null)}
        />
      )}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onEdit={(task) => { setDetailTask(null); setCreateForDate(null); setDayModal(null); setEditTask(task); }}
          onChanged={(updated) => { if (updated) setDetailTask(updated); afterMutation(); }}
          onClose={() => setDetailTask(null)}
        />
      )}
      {dayModal && (
        <DayModal
          ymd={dayModal}
          tasks={byDate[dayModal] || []}
          activity={activityByDay[dayModal] || []}
          onOpenTask={(task) => { setDayModal(null); setDetailTask(task); }}
          onAddTask={(day) => { setDayModal(null); setCreateForDate(day); }}
          onClose={() => setDayModal(null)}
        />
      )}
      {reportOpen && (
        <ActivityReportModal currentUser={currentUser} onClose={() => setReportOpen(false)} />
      )}
    </div>
  );
}
