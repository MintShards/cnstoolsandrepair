import { TASK_PRIORITIES, RECURRENCE_LABELS } from '../../constants/workspace';
import { getTodayPacific, formatYmd } from '../../utils/dateFormat';
import StaffAvatar from './StaffAvatar';
import WorkOrderChip from './WorkOrderChip';

/** Board card. Click opens the detail modal; the whole card is draggable. */
export default function TaskCard({ task, onOpen, onClaim, claimingId }) {
  const overdue = task.status !== 'done' && task.due_date && task.due_date < getTodayPacific();
  const priority = TASK_PRIORITIES[task.priority] || TASK_PRIORITIES.normal;
  const claiming = claimingId === task.id;

  return (
    <div
      onClick={() => onOpen(task)}
      className={`group cursor-pointer rounded-xl border p-3 shadow-sm hover:shadow-md transition-all bg-white dark:bg-slate-800 ${
        overdue
          ? 'border-red-300 dark:border-red-800/60'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-bold leading-snug text-slate-900 dark:text-white ${task.status === 'done' ? 'line-through opacity-60' : ''}`}>
          {task.title}
        </p>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase border flex-shrink-0 ${priority.color}`}>
          {priority.label}
        </span>
      </div>

      {task.details && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{task.details}</p>
      )}

      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
        {task.due_date && (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[11px] font-bold whitespace-nowrap ${
            overdue
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'
          }`}>
            <span className="material-symbols-outlined text-xs">event</span>
            {formatYmd(task.due_date)}
            {overdue && <span className="uppercase">· Overdue</span>}
          </span>
        )}
        {task.recurrence && task.recurrence !== 'none' && (
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400"
            title={`${RECURRENCE_LABELS[task.recurrence]} — completing schedules the next one`}
          >
            <span className="material-symbols-outlined text-xs">repeat</span>
            {RECURRENCE_LABELS[task.recurrence]}
          </span>
        )}
        <WorkOrderChip repairId={task.repair_id} requestNumber={task.request_number} />
      </div>

      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
        {task.assignee_id ? (
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <StaffAvatar userId={task.assignee_id} name={task.assignee_name} size="sm" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">{task.assignee_name}</span>
          </span>
        ) : task.status !== 'done' ? (
          <button
            onClick={(e) => { e.stopPropagation(); onClaim(task); }}
            disabled={claiming}
            title="Assign this task to yourself"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black uppercase bg-accent-orange/10 hover:bg-accent-orange/20 border border-accent-orange/40 text-accent-orange transition-colors disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-xs ${claiming ? 'animate-spin' : ''}`}>
              {claiming ? 'progress_activity' : 'front_hand'}
            </span>
            Claim
          </button>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">Unassigned</span>
        )}
        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate" title={`Created by ${task.created_by?.name}`}>
          {task.created_by?.name}
        </span>
      </div>
    </div>
  );
}
