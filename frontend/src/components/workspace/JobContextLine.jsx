import { REPAIR_STATUSES } from '../../constants/repairStatuses';

const FALLBACK_STATUS = {
  label: '—',
  color: 'bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-700/60 dark:text-slate-300 dark:border-slate-500',
  dot: 'bg-slate-400 dark:bg-slate-400',
};

/** Tracker-coloured status pill sized for card meta lines. */
export function RepairStatusMini({ status }) {
  const cfg = REPAIR_STATUSES[status] || { ...FALLBACK_STATUS, label: status };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${cfg.color}`}>
      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.shortLabel ?? cfg.label}
    </span>
  );
}

/**
 * One muted line of LIVE work-order context under a task — who the customer
 * is, what the tool is, and where the job stands right now. `job` comes
 * joined from the tasks API at read time, so it never goes stale.
 */
export default function JobContextLine({ job, className = '' }) {
  if (!job || (!job.company && !job.tool)) return null;
  return (
    // Wraps: a multi-tool job can carry three status pills, which on a phone
    // card would otherwise squeeze the customer/tool text to nothing.
    <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0 ${className}`}>
      <span className="material-symbols-outlined text-sm text-slate-400 dark:text-slate-500 flex-shrink-0" aria-hidden="true">storefront</span>
      <span className="min-w-[8rem] flex-1 truncate text-xs text-slate-500 dark:text-slate-400">
        {job.company && <span className="font-bold text-slate-600 dark:text-slate-300">{job.company}</span>}
        {job.company && job.tool && ' · '}
        {job.tool}
      </span>
      <span className="flex flex-wrap items-center gap-1">
        {(job.statuses || []).map((s) => <RepairStatusMini key={s} status={s} />)}
      </span>
    </div>
  );
}
