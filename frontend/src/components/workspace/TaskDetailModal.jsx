import { useState } from 'react';
import { tasksAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import useEscapeClose from '../../utils/useEscapeClose';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import { TASK_STATUS_LIST, TASK_PRIORITIES, RECURRENCE_LABELS } from '../../constants/workspace';
import { getTodayPacific, formatYmd, formatDatePacific } from '../../utils/dateFormat';
import StaffAvatar from './StaffAvatar';
import WorkOrderChip from './WorkOrderChip';
import ConfirmModal from '../sales/ConfirmModal';

/**
 * Read view + quick actions for one task: status switcher, claim, edit,
 * delete. Heavier edits go through TaskFormModal via onEdit.
 */
export default function TaskDetailModal({ task, onEdit, onChanged, onClose }) {
  const showToast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEscapeClose(confirmingDelete ? () => {} : onClose);
  useBodyScrollLock(true);

  const priority = TASK_PRIORITIES[task.priority] || TASK_PRIORITIES.normal;
  const overdue = task.status !== 'done' && task.due_date && task.due_date < getTodayPacific();

  const setStatus = async (statusValue) => {
    if (statusValue === task.status || busy) return;
    setBusy(true);
    try {
      const updated = await tasksAPI.update(task.id, { status: statusValue });
      showToast('success', statusValue === 'done' ? 'Task completed.' : 'Status updated.');
      onChanged(updated);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to update the status.'));
    } finally {
      setBusy(false);
    }
  };

  const handleClaim = async () => {
    setBusy(true);
    try {
      const updated = await tasksAPI.claim(task.id);
      showToast('success', 'Task claimed — it’s yours.');
      onChanged(updated);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to claim the task.'));
      onChanged(null); // someone else may have grabbed it — refetch
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await tasksAPI.delete(task.id);
      showToast('success', 'Task deleted.');
      onChanged(null);
      onClose();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to delete the task.'));
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  };

  return (
    // Backdrop tap closes — on phones this modal has no Cancel button and
    // Escape doesn't exist, so the X must not be the only way out. The
    // currentTarget check keeps clicks inside the panel (and the nested
    // delete-confirm overlay) from closing it.
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget && !confirmingDelete) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="min-w-0">
            <h2 className={`font-black text-slate-900 dark:text-white tracking-tight leading-snug break-words ${task.status === 'done' ? 'line-through opacity-70' : ''}`}>
              {task.title}
            </h2>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase border ${priority.color}`}>
                {priority.label}
              </span>
              {task.recurrence && task.recurrence !== 'none' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined text-xs">repeat</span>
                  {RECURRENCE_LABELS[task.recurrence]}
                </span>
              )}
              <WorkOrderChip repairId={task.repair_id} requestNumber={task.request_number} />
            </div>
          </div>
          <button onClick={onClose} className="p-2 -m-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex-shrink-0">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Status switcher */}
          <div className="flex gap-2">
            {TASK_STATUS_LIST.map((s) => (
              <button
                key={s.value}
                type="button"
                disabled={busy}
                onClick={() => setStatus(s.value)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 transition-all font-bold text-[11px] sm:text-xs uppercase whitespace-nowrap disabled:opacity-60 ${
                  task.status === s.value
                    ? 'border-primary bg-primary/5 text-slate-900 dark:text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {/* The dot doesn't fit beside "IN PROGRESS" at 375px — it
                    forced a two-line wrap that stretched all three pills. */}
                <span className={`hidden sm:block w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                {s.label}
              </button>
            ))}
          </div>
          {task.recurrence && task.recurrence !== 'none' && task.status !== 'done' && (
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
              Marking this done automatically schedules the next occurrence.
            </p>
          )}

          {task.details && (
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">{task.details}</p>
          )}

          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 divide-y divide-slate-200 dark:divide-slate-700/60 text-sm">
            <div className="flex items-center justify-between px-4 py-2.5 gap-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Assigned to</span>
              {task.assignee_id ? (
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <StaffAvatar userId={task.assignee_id} name={task.assignee_name} size="sm" />
                  <span className="font-bold text-slate-900 dark:text-white truncate">{task.assignee_name}</span>
                </span>
              ) : (
                <button
                  onClick={handleClaim}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase bg-accent-orange/10 hover:bg-accent-orange/20 border border-accent-orange/40 text-accent-orange transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-xs">front_hand</span>
                  Claim it
                </button>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 gap-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Due</span>
              <span className={`font-bold ${overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                {task.due_date ? formatYmd(task.due_date) : '—'}
                {overdue && <span className="ml-1.5 text-[10px] uppercase tracking-wide">Overdue</span>}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 gap-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Created</span>
              <span className="text-slate-600 dark:text-slate-300 text-right">
                {formatDatePacific(task.created_at)}
                {task.created_by?.name && <span className="block text-xs text-slate-400">by {task.created_by.name}</span>}
              </span>
            </div>
            {task.status === 'done' && task.completed_at && (
              <div className="flex items-center justify-between px-4 py-2.5 gap-3">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Completed</span>
                <span className="text-slate-600 dark:text-slate-300 text-right">
                  {formatDatePacific(task.completed_at)}
                  {task.completed_by?.name && <span className="block text-xs text-slate-400">by {task.completed_by.name}</span>}
                </span>
              </div>
            )}
          </div>

          {task.spawned_from && (
            <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">repeat</span>
              Scheduled automatically by a recurring task.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              title="Delete this task"
              className="px-4 py-2.5 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold rounded-xl transition-colors text-sm disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base align-middle">delete</span>
            </button>
            <button
              onClick={() => onEdit(task)}
              disabled={busy}
              className="flex-1 py-2.5 bg-primary hover:bg-blue-500 text-white font-black rounded-xl transition-colors text-sm uppercase disabled:opacity-50"
            >
              Edit Task
            </button>
          </div>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmModal
          message={`Delete "${task.title}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
