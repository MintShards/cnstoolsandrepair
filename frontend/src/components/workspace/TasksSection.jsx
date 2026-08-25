import { useState, useEffect, useCallback } from 'react';
import { tasksAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import usePollWhileVisible from '../../utils/usePollWhileVisible';
import TabHeader from '../sales/TabHeader';
import useSort from '../sales/useSort';
import { DEFAULT_PAGE_SIZE } from '../sales/pageSize';
import { BTN_PRIMARY, BTN_NEUTRAL, FILTER_INPUT } from '../sales/ui';
import { TASK_STATUS_LIST, TASK_PRIORITY_LIST } from '../../constants/workspace';
import AttentionPanel from './AttentionPanel';
import TaskBoard from './TaskBoard';
import TaskList from './TaskList';
import TaskFormModal from './TaskFormModal';
import TaskDetailModal from './TaskDetailModal';
import LogCallModal from './LogCallModal';

// Later-clicked columns start with their useful direction, not ascending.
const FIRST_DIRS = { priority: 'desc', created_at: 'desc', completed_at: 'desc' };

const BOARD_POLL_MS = 30000;
const LIST_POLL_MS = 60000;

/**
 * My Tasks / All Tasks host: board and list views over the same filters,
 * polling refresh, batch complete, and the create/edit/detail modals.
 */
export default function TasksSection({ scope, currentUser, staff, refreshCounts, focusTick }) {
  const showToast = useToast();
  const mine = scope === 'mine';

  const [view, setView] = useState(() => localStorage.getItem('ws_task_view') || 'board');
  const [statusFilter, setStatusFilter] = useState('open');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');

  const [boardTasks, setBoardTasks] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  const [batchSelected, setBatchSelected] = useState(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [claimingId, setClaimingId] = useState(null);

  // undefined = closed, null = create, object = edit that task
  const [formTask, setFormTask] = useState(undefined);
  const [formDefaults, setFormDefaults] = useState({});
  const [detailTask, setDetailTask] = useState(null);
  const [showLogCall, setShowLogCall] = useState(false);

  const { sortBy, sortDir, handleSort } = useSort(
    'due_date', 'asc', FIRST_DIRS, () => setCurrentPage(1),
  );

  const setViewPersist = (v) => {
    setView(v);
    localStorage.setItem('ws_task_view', v);
  };

  const assigneeParam = mine ? 'me' : (assigneeFilter || undefined);

  const loadBoard = useCallback(async () => {
    // Open cards plus a short tail of recently finished ones for the Done column.
    const [openRes, doneRes] = await Promise.all([
      tasksAPI.list({
        status: 'open', assignee: assigneeParam, priority: priorityFilter || undefined,
        limit: 200, sort_by: 'due_date', sort_dir: 'asc',
      }),
      tasksAPI.list({
        status: 'done', assignee: assigneeParam, priority: priorityFilter || undefined,
        limit: 25, sort_by: 'completed_at', sort_dir: 'desc',
      }),
    ]);
    setBoardTasks([...openRes.tasks, ...doneRes.tasks]);
  }, [assigneeParam, priorityFilter]);

  const loadList = useCallback(async () => {
    const { tasks, total: t } = await tasksAPI.list({
      status: statusFilter || undefined,
      assignee: assigneeParam,
      priority: priorityFilter || undefined,
      skip: (currentPage - 1) * pageSize,
      limit: pageSize,
      sort_by: sortBy,
      sort_dir: sortDir,
    });
    setRows(tasks);
    setTotal(t);
  }, [statusFilter, assigneeParam, priorityFilter, currentPage, pageSize, sortBy, sortDir]);

  const load = useCallback(async (withSpinner = false) => {
    if (withSpinner) setLoading(true);
    try {
      await (view === 'board' ? loadBoard() : loadList());
    } catch {
      showToast('error', 'Failed to load tasks.');
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, [view, loadBoard, loadList, showToast]);

  useEffect(() => { load(true); }, [load]);

  // Sync: quiet interval refetch while this section is on screen — skipped
  // while the tab is hidden (the focus catch-up below covers re-entry).
  usePollWhileVisible(() => load(false), view === 'board' ? BOARD_POLL_MS : LIST_POLL_MS);

  // Sync: immediate catch-up when the browser tab regains focus.
  useEffect(() => {
    if (focusTick > 0) load(false);
  }, [focusTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const afterMutation = useCallback(() => {
    load(false);
    refreshCounts();
  }, [load, refreshCounts]);

  // Board drag: optimistic move, roll back on failure.
  const handleMove = async (task, newStatus) => {
    const previous = boardTasks;
    setBoardTasks((tasks) => tasks.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    try {
      await tasksAPI.update(task.id, { status: newStatus });
      if (newStatus === 'done') showToast('success', `"${task.title}" completed.`);
      afterMutation();
    } catch (err) {
      setBoardTasks(previous);
      showToast('error', apiErrorMessage(err, 'Failed to move the task.'));
    }
  };

  const handleClaim = async (task) => {
    setClaimingId(task.id);
    try {
      await tasksAPI.claim(task.id);
      showToast('success', 'Task claimed — it’s yours.');
      afterMutation();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Someone may have beaten you to it.'));
      load(false);
    } finally {
      setClaimingId(null);
    }
  };

  const handleComplete = async (task) => {
    setCompletingId(task.id);
    try {
      await tasksAPI.update(task.id, { status: 'done' });
      showToast('success', 'Task completed.');
      setBatchSelected((prev) => {
        if (!prev.has(task.id)) return prev;
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      afterMutation();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to complete the task.'));
    } finally {
      setCompletingId(null);
    }
  };

  const toggleSelect = (taskId) => {
    setBatchSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleSelectAllPage = (selectableRows) => {
    setBatchSelected((prev) => {
      const allSelected = selectableRows.every((t) => prev.has(t.id));
      const next = new Set(prev);
      selectableRows.forEach((t) => (allSelected ? next.delete(t.id) : next.add(t.id)));
      return next;
    });
  };

  const handleBatchComplete = async () => {
    setBatchBusy(true);
    try {
      const result = await tasksAPI.batchComplete([...batchSelected]);
      if (result.success_count > 0) {
        showToast('success', `${result.success_count} task${result.success_count === 1 ? '' : 's'} completed.`);
      }
      if (result.failure_count > 0) {
        showToast('error', `${result.failure_count} could not be completed.`);
      }
      setBatchSelected(new Set());
      afterMutation();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Batch complete failed.'));
    } finally {
      setBatchBusy(false);
    }
  };

  const openCreate = () => {
    setFormDefaults({ defaultAssigneeId: mine ? currentUser?.id : '' });
    setFormTask(null);
  };

  const handleFormSaved = () => {
    setFormTask(undefined);
    afterMutation();
  };

  const handleDetailChanged = (updated) => {
    if (updated) setDetailTask(updated);
    afterMutation();
  };

  const activeStaff = (staff || []).filter((s) => s.is_active);

  return (
    <div>
      <TabHeader
        title={mine ? 'My Tasks' : 'All Tasks'}
        subtitle={mine ? 'Everything assigned to you' : 'The whole shop’s to-do list'}
        action={(
          // Tracker-style: labels hide below sm so both actions sit beside
          // the title as compact icon buttons instead of stacked full-width.
          <div className="flex flex-row gap-2">
            <button onClick={() => setShowLogCall(true)} className={BTN_NEUTRAL} title="Log a customer call">
              <span className="material-symbols-outlined text-base">phone_in_talk</span>
              <span className="hidden sm:inline">Log Call</span>
            </button>
            <button onClick={openCreate} className={BTN_PRIMARY} title="New task">
              <span className="material-symbols-outlined text-base">add</span>
              <span className="hidden sm:inline">New Task</span>
            </button>
          </div>
        )}
      >
        {/* View switcher. In the phone filter grid it gets a half-width cell,
            so it fills that cell and the two segments split it evenly —
            the fixed-padding inline version overflowed and clipped "List". */}
        <div className="flex w-full sm:w-auto sm:inline-flex rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden self-start">
          {[
            { id: 'board', icon: 'view_kanban', label: 'Board' },
            { id: 'list', icon: 'table_rows', label: 'List' },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setViewPersist(v.id)}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-2.5 text-sm font-bold transition-colors ${
                view === v.id
                  ? 'bg-primary text-white'
                  : 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>

        {view === 'list' && (
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className={FILTER_INPUT}>
            <option value="open">Open (not done)</option>
            <option value="">All statuses</option>
            {TASK_STATUS_LIST.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        )}

        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }} className={FILTER_INPUT}>
          <option value="">All priorities</option>
          {TASK_PRIORITY_LIST.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {!mine && (
          <select value={assigneeFilter} onChange={(e) => { setAssigneeFilter(e.target.value); setCurrentPage(1); }} className={FILTER_INPUT}>
            <option value="">Everyone</option>
            <option value="unassigned">Unassigned</option>
            {activeStaff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        {view === 'list' && batchSelected.size > 0 && (
          <button onClick={handleBatchComplete} disabled={batchBusy} className={`${BTN_PRIMARY} disabled:opacity-50 col-span-2`}>
            <span className={`material-symbols-outlined text-base ${batchBusy ? 'animate-spin' : ''}`}>
              {batchBusy ? 'progress_activity' : 'done_all'}
            </span>
            Complete selected ({batchSelected.size})
          </button>
        )}
      </TabHeader>

      {view === 'board' ? (
        loading && boardTasks.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-3 text-slate-500 dark:text-slate-400">Loading tasks...</p>
          </div>
        ) : (
          <TaskBoard
            tasks={boardTasks}
            onMove={handleMove}
            onOpen={setDetailTask}
            onClaim={handleClaim}
            claimingId={claimingId}
          />
        )
      ) : (
        <TaskList
          rows={rows}
          loading={loading}
          total={total}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          batchSelected={batchSelected}
          onToggleSelect={toggleSelect}
          onToggleSelectAllPage={toggleSelectAllPage}
          completingId={completingId}
          claimingId={claimingId}
          onComplete={handleComplete}
          onClaim={handleClaim}
          onOpen={setDetailTask}
        />
      )}

      {/* The shop-wide "what needs doing" queues sit BELOW the task list —
          the crew's own board is the first thing on screen; the derived
          tracker queues are the reference material underneath. My Tasks
          stays personal and has no panel. */}
      {!mine && (
        <div className="mt-6">
          <AttentionPanel staff={staff} focusTick={focusTick} onTaskCreated={afterMutation} />
        </div>
      )}

      {formTask !== undefined && (
        <TaskFormModal
          task={formTask}
          staff={staff}
          defaultAssigneeId={formDefaults.defaultAssigneeId}
          onSaved={handleFormSaved}
          onClose={() => setFormTask(undefined)}
        />
      )}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onEdit={(task) => { setDetailTask(null); setFormDefaults({}); setFormTask(task); }}
          onChanged={handleDetailChanged}
          onClose={() => setDetailTask(null)}
        />
      )}
      {showLogCall && (
        <LogCallModal
          staff={staff}
          onLogged={() => { setShowLogCall(false); afterMutation(); }}
          onClose={() => setShowLogCall(false)}
        />
      )}
    </div>
  );
}
