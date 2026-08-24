import { useState, useEffect, useCallback, useMemo } from 'react';
import { tasksAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import usePollWhileVisible from '../../utils/usePollWhileVisible';
import TabHeader from '../sales/TabHeader';
import { BTN_NEUTRAL, ICON_BTN } from '../sales/ui';
import { TASK_PRIORITIES } from '../../constants/workspace';
import { getTodayPacific, formatYmd } from '../../utils/dateFormat';
import useEscapeClose from '../../utils/useEscapeClose';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import StaffAvatar from './StaffAvatar';
import TaskFormModal from './TaskFormModal';
import TaskDetailModal from './TaskDetailModal';

const POLL_MS = 60000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS = 3;

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

function DayTasksModal({ ymd, tasks, onOpenTask, onClose }) {
  useEscapeClose(onClose);
  useBodyScrollLock(true);
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{formatYmd(ymd)}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
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
        subtitle="Tasks by due date — click a day to add one"
        action={(
          // flex-wrap: at 360px-class phones the widest month label leaves no
          // slack; wrapping beats forcing horizontal page scroll.
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => setShowDone((v) => !v)}
              className={`${BTN_NEUTRAL} ${showDone ? '' : 'opacity-60'}`}
              title={showDone ? 'Hide completed tasks' : 'Show completed tasks'}
            >
              <span className="material-symbols-outlined text-base">{showDone ? 'visibility' : 'visibility_off'}</span>
              <span className="hidden sm:inline">Done</span>
            </button>
            <button onClick={goToday} className={BTN_NEUTRAL}>Today</button>
            <button onClick={() => shiftMonth(-1)} className={ICON_BTN} aria-label="Previous month">
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
            <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight whitespace-nowrap sm:min-w-[130px] text-center">
              {monthLabel}
            </span>
            <button onClick={() => shiftMonth(1)} className={ICON_BTN} aria-label="Next month">
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
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
              const isToday = cell.ymd === todayYmd;
              const overflow = dayTasks.length - MAX_CHIPS;
              return (
                <div
                  key={cell.ymd}
                  onClick={() => setCreateForDate(cell.ymd)}
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
                  <div className="mt-1 space-y-1">
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
        <DayTasksModal
          ymd={dayModal}
          tasks={byDate[dayModal] || []}
          onOpenTask={(task) => { setDayModal(null); setDetailTask(task); }}
          onClose={() => setDayModal(null)}
        />
      )}
    </div>
  );
}
