import SortableTh from '../sales/SortableTh';
import PaginationBar from '../admin/shared/PaginationBar';
import { PAGE_SIZE_OPTIONS } from '../sales/pageSize';
import { TASK_STATUSES, TASK_PRIORITIES } from '../../constants/workspace';
import { getTodayPacific, formatYmd } from '../../utils/dateFormat';
import StaffAvatar from './StaffAvatar';
import WorkOrderChip from './WorkOrderChip';

/**
 * Sortable, paginated task table with batch selection — the power view for
 * filtering and clearing many tasks at once. Rows open the detail modal.
 */
export default function TaskList({
  rows, loading, total,
  currentPage, pageSize, onPageChange, onPageSizeChange,
  sortBy, sortDir, onSort,
  batchSelected, onToggleSelect, onToggleSelectAllPage,
  completingId, claimingId, onComplete, onClaim, onOpen,
}) {
  const today = getTodayPacific();
  const selectableRows = rows.filter((t) => t.status !== 'done');
  const allPageSelected = selectableRows.length > 0 && selectableRows.every((t) => batchSelected.has(t.id));

  return (
    <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
      {loading && rows.length === 0 ? (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
          <p className="mt-3 text-slate-500 dark:text-slate-400">Loading tasks...</p>
        </div>
      ) : !loading && rows.length === 0 ? (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-3">task_alt</span>
          <p className="text-slate-500 dark:text-slate-400 font-medium">All caught up — nothing matches these filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-base text-left">
            <thead className="text-sm uppercase text-slate-500 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60">
              <tr>
                <th className="py-3 pl-4 pr-1 w-8">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={() => onToggleSelectAllPage(selectableRows)}
                    title="Select every open task on this page"
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/50 bg-white dark:bg-slate-700 cursor-pointer"
                  />
                </th>
                {[
                  { field: 'due_date',   label: 'Due',      cls: 'px-3 sm:px-4 hidden sm:table-cell' },
                  { field: 'title',      label: 'Task',     cls: 'px-3 sm:px-4' },
                  { field: 'priority',   label: 'Priority', cls: 'px-4 hidden md:table-cell' },
                  { field: 'status',     label: 'Status',   cls: 'px-4 hidden sm:table-cell' },
                ].map((col) => (
                  <SortableTh key={col.field} {...col} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                ))}
                <th className="py-3 px-4 font-bold hidden lg:table-cell">Assigned</th>
                <th className="py-3 px-2 sm:px-4 text-right font-bold">
                  <span className="sr-only sm:not-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
              {rows.map((task) => {
                const overdue = task.status !== 'done' && task.due_date && task.due_date < today;
                const status = TASK_STATUSES[task.status] || TASK_STATUSES.todo;
                const priority = TASK_PRIORITIES[task.priority] || TASK_PRIORITIES.normal;
                const done = task.status === 'done';
                return (
                  <tr
                    key={task.id}
                    onClick={() => onOpen(task)}
                    className={`cursor-pointer transition-colors ${
                      overdue
                        ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    <td className="py-3.5 pl-4 pr-1" onClick={(e) => e.stopPropagation()}>
                      {!done && (
                        <input
                          type="checkbox"
                          checked={batchSelected.has(task.id)}
                          onChange={() => onToggleSelect(task.id)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/50 bg-white dark:bg-slate-700 cursor-pointer"
                        />
                      )}
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap hidden sm:table-cell">
                      {task.due_date ? (
                        <>
                          <div className={`font-bold ${overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                            {formatYmd(task.due_date)}
                          </div>
                          {overdue && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                              Overdue
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 max-w-[160px] sm:max-w-[280px]">
                      {task.due_date && (
                        <div className={`sm:hidden text-xs font-bold whitespace-nowrap ${overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {formatYmd(task.due_date)}
                          {overdue && <span className="uppercase tracking-wide"> · Overdue</span>}
                        </div>
                      )}
                      <div className={`text-slate-900 dark:text-white font-bold truncate ${done ? 'line-through opacity-60' : ''}`}>
                        {task.title}
                        {task.recurrence && task.recurrence !== 'none' && (
                          <span className="material-symbols-outlined text-sm align-middle ml-1 text-slate-400" title="Recurring task">repeat</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {task.details && (
                          <span className="text-slate-500 dark:text-slate-400 text-sm truncate">{task.details}</span>
                        )}
                        <WorkOrderChip repairId={task.repair_id} requestNumber={task.request_number} />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 hidden md:table-cell">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-bold border ${priority.color}`}>
                        {priority.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 hidden sm:table-cell whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm font-bold border ${status.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 hidden lg:table-cell">
                      {task.assignee_id ? (
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <StaffAvatar userId={task.assignee_id} name={task.assignee_name} size="sm" />
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{task.assignee_name}</span>
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400 dark:text-slate-500">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-2 sm:px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1 sm:gap-1.5">
                        {!task.assignee_id && !done && (
                          <button
                            onClick={() => onClaim(task)}
                            disabled={claimingId === task.id}
                            title="Assign this task to yourself"
                            className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-accent-orange/10 hover:bg-accent-orange/20 border border-accent-orange/40 text-accent-orange rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                          >
                            <span className={`material-symbols-outlined text-base ${claimingId === task.id ? 'animate-spin' : ''}`}>
                              {claimingId === task.id ? 'progress_activity' : 'front_hand'}
                            </span>
                            <span className="hidden xl:inline">Claim</span>
                          </button>
                        )}
                        {!done && (
                          <button
                            onClick={() => onComplete(task)}
                            disabled={completingId === task.id}
                            title="Mark this task done"
                            className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-green-100 dark:hover:bg-green-900/30 border border-slate-300 dark:border-slate-600/50 hover:border-green-400 text-slate-600 dark:text-slate-300 hover:text-green-700 dark:hover:text-green-400 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                          >
                            <span className={`material-symbols-outlined text-base ${completingId === task.id ? 'animate-spin' : ''}`}>
                              {completingId === task.id ? 'progress_activity' : 'check'}
                            </span>
                            <span className="hidden xl:inline">Done</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <PaginationBar
        currentPage={currentPage}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </div>
  );
}
