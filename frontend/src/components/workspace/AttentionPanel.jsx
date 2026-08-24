import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { repairsAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import usePollWhileVisible from '../../utils/usePollWhileVisible';
import { formatYmd } from '../../utils/dateFormat';
import WorkOrderChip from './WorkOrderChip';
import TaskFormModal from './TaskFormModal';

const POLL_MS = 60000;
const ROWS_SHOWN = 5;

/**
 * Queue metadata, in display order. `verb` builds the prefilled task title
 * when a row is escalated to a real assigned task.
 */
const QUEUES = [
  { key: 'stuck', label: 'Stuck — nothing has moved', icon: 'hourglass_disabled', verb: 'Unstick', red: true },
  { key: 'needs_diagnosis', label: 'Needs diagnosis', icon: 'search', verb: 'Diagnose' },
  { key: 'needs_quote', label: 'Needs quoting', icon: 'request_quote', verb: 'Quote' },
  { key: 'waiting_on_customer', label: 'Waiting on customer', icon: 'hourglass_top', verb: 'Chase customer on' },
  { key: 'start_work', label: 'Approved — start work', icon: 'play_circle', verb: 'Start work on' },
  { key: 'chase_parts', label: 'Parts to chase', icon: 'local_shipping', verb: 'Chase parts for' },
  { key: 'needs_invoice', label: 'Needs invoicing', icon: 'receipt_long', verb: 'Invoice' },
  { key: 'ready_for_pickup', label: 'Ready for pickup — call customer', icon: 'call', verb: 'Arrange pickup for' },
];

const PRIORITY_BADGE = {
  rush: 'bg-orange-100 text-orange-700 border-orange-400 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700',
  urgent: 'bg-red-100 text-red-700 border-red-400 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
};

function AgePill({ days, stuck }) {
  return (
    <span
      title={`${days} day${days === 1 ? '' : 's'} in this state`}
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[11px] font-bold whitespace-nowrap ${
        stuck
          ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
          : 'bg-slate-200/70 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'
      }`}
    >
      <span className="material-symbols-outlined text-xs">schedule</span>
      {days}d
    </span>
  );
}

function QueueRow({ item, verb, onAssign }) {
  const priorityCls = PRIORITY_BADGE[item.priority];
  return (
    // Phones get two lines (chips + signals on top, the job's identity
    // full-width below) — a single line at 375px left ~50px for the company
    // name, which is the one thing the row exists to show.
    <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
      <WorkOrderChip repairId={item.job_id} requestNumber={item.request_number} />
      {/* truncate lives on this block parent — putting it on inline children
          silently stops clipping (overflow doesn't apply to display:inline). */}
      <span
        className="order-last w-full sm:order-none sm:w-auto sm:flex-1 min-w-0 text-sm truncate"
        title={item.tools && item.tools.length > 1 ? item.tools.join(' · ') : undefined}
      >
        <span className="font-bold text-slate-900 dark:text-white">{item.company}</span>
        <span className="text-slate-500 dark:text-slate-400 ml-1.5">{item.tool}</span>
      </span>
      {priorityCls && (
        <>
          <span
            className={`sm:hidden w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.priority === 'urgent' ? 'bg-red-500' : 'bg-orange-400'}`}
            title={`${item.priority} priority`}
          />
          <span className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase border ${priorityCls}`}>
            {item.priority}
          </span>
        </>
      )}
      {item.parts_overdue > 0 && (
        <>
          <span
            className="sm:hidden material-symbols-outlined text-base text-red-500 flex-shrink-0"
            title={`${item.parts_overdue} part${item.parts_overdue === 1 ? '' : 's'} past the ETA`}
          >
            local_shipping
          </span>
          <span
            className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[11px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 whitespace-nowrap"
            title={`${item.parts_overdue} part${item.parts_overdue === 1 ? '' : 's'} past the ETA`}
          >
            <span className="material-symbols-outlined text-xs">local_shipping</span>
            {item.parts_overdue} late
          </span>
        </>
      )}
      <AgePill days={item.days_in_status} stuck={item.stuck} />
      <button
        onClick={() => onAssign(item, verb)}
        title="Assign this as a task to someone"
        className="inline-flex items-center px-2.5 py-2 rounded-lg text-xs font-bold bg-accent-orange/10 hover:bg-accent-orange/20 border border-accent-orange/40 text-accent-orange transition-colors flex-shrink-0 ml-auto sm:ml-0"
      >
        <span className="material-symbols-outlined text-base">assignment_ind</span>
      </button>
    </div>
  );
}

function FollowUpRow({ item }) {
  const overdue = item.days_overdue > 0;
  return (
    <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
      <span className="material-symbols-outlined text-base text-accent-orange flex-shrink-0">door_front</span>
      <span className="order-last w-full sm:order-none sm:w-auto sm:flex-1 min-w-0 text-sm truncate">
        <span className="font-bold text-slate-900 dark:text-white">{item.business_name}</span>
        {item.follow_up_note && (
          <span className="text-slate-500 dark:text-slate-400 ml-1.5">{item.follow_up_note}</span>
        )}
      </span>
      {item.rep_name && (
        <span className="hidden md:inline text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">{item.rep_name}</span>
      )}
      <span className={`text-xs font-bold whitespace-nowrap ${overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
        {formatYmd(item.follow_up_date)}
        {overdue && ` · ${item.days_overdue}d late`}
      </span>
    </div>
  );
}

/**
 * "Needs Attention" — the shop's live to-do queues, rendered above All Tasks.
 * Everything here is DERIVED from the Repair Tracker's tool statuses and the
 * route-management follow-up dates: work the job in the tracker and the row
 * disappears on its own, no ticking. The assign button is the bridge into the
 * real task system for anything that needs a specific owner and due date.
 * `onTaskCreated` lets the host section refresh its task list immediately.
 */
export default function AttentionPanel({ staff, focusTick, onTaskCreated }) {
  const showToast = useToast();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(() => localStorage.getItem('ws_attention_open') !== '0');
  const [taskSeed, setTaskSeed] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await repairsAPI.attention({ include_items: true }));
    } catch {
      showToast('error', 'Failed to load the attention queues.');
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);
  usePollWhileVisible(load, POLL_MS);
  useEffect(() => {
    if (focusTick > 0) load();
  }, [focusTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleOpen = () => {
    setOpen((v) => {
      localStorage.setItem('ws_attention_open', v ? '0' : '1');
      return !v;
    });
  };

  const handleAssign = (item, verb) => {
    setTaskSeed({
      title: `${verb} ${item.request_number} — ${item.company}`,
      workOrder: { repair_id: item.job_id, request_number: item.request_number },
    });
  };

  if (!data) return null;

  const followups = data.queues.followups_due;
  const nonEmpty = QUEUES.filter((q) => data.queues[q.key]?.count > 0);
  const allClear = data.total === 0 && data.stuck_count === 0;

  return (
    <div className="mb-5 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-800/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
      {/* Panel header */}
      <button
        onClick={toggleOpen}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        title={open ? 'Collapse' : 'Expand'}
      >
        <span className="material-symbols-outlined text-xl text-accent-orange">priority_high</span>
        <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Needs Attention</span>
        {data.total > 0 && (
          <span className="text-xs font-black px-2 py-0.5 rounded-full bg-primary text-white leading-none">{data.total}</span>
        )}
        {data.stuck_count > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 leading-none">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {data.stuck_count} stuck
          </span>
        )}
        <span className="hidden sm:inline text-xs text-slate-400 dark:text-slate-500">live from the Repair Tracker — work the job and the row clears itself</span>
        <span className="flex-1" />
        <span className="material-symbols-outlined text-base text-slate-400">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {allClear ? (
            <p className="flex items-center gap-1.5 px-1 pb-1 text-sm text-green-700 dark:text-green-400 font-bold">
              <span className="material-symbols-outlined text-base">check_circle</span>
              All clear — nothing needs attention right now.
            </p>
          ) : (
            <>
              {nonEmpty.map((q) => {
                const bucket = data.queues[q.key];
                const items = bucket.items || [];
                return (
                  <div key={q.key}>
                    <p className={`flex items-center gap-1.5 px-1 pb-1.5 text-xs font-bold uppercase tracking-wide ${
                      q.red ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      <span className="material-symbols-outlined text-sm">{q.icon}</span>
                      {q.label}
                      <span className="font-black">({bucket.count})</span>
                    </p>
                    <div className="space-y-1.5">
                      {items.slice(0, ROWS_SHOWN).map((item) => (
                        <QueueRow key={`${q.key}-${item.job_id}`} item={item} verb={q.verb} onAssign={handleAssign} />
                      ))}
                      {bucket.count > ROWS_SHOWN && (
                        <Link
                          to="/admin/repair-tracker?tab=jobs"
                          className="block px-3 py-1 text-xs font-bold text-primary dark:text-blue-400 hover:underline"
                        >
                          +{bucket.count - ROWS_SHOWN} more — open the Repair Tracker →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}

              {followups.count > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 px-1 pb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <span className="material-symbols-outlined text-sm">door_front</span>
                    Door-to-door follow-ups due
                    <span className="font-black">({followups.count})</span>
                  </p>
                  <div className="space-y-1.5">
                    {(followups.items || []).slice(0, ROWS_SHOWN).map((item) => (
                      <FollowUpRow key={item.visit_id} item={item} />
                    ))}
                    <Link
                      to="/sales/dashboard?tab=follow-ups"
                      className="block px-3 py-1 text-xs font-bold text-primary dark:text-blue-400 hover:underline"
                    >
                      Open Route Management follow-ups →
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {taskSeed && (
        <TaskFormModal
          task={null}
          staff={staff}
          defaultTitle={taskSeed.title}
          defaultWorkOrder={taskSeed.workOrder}
          onSaved={() => { setTaskSeed(null); onTaskCreated(); }}
          onClose={() => setTaskSeed(null)}
        />
      )}
    </div>
  );
}
