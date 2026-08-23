import { Link } from 'react-router-dom';

/**
 * Clickable work-order pill. Deep-links into the Repair Tracker's jobs tab,
 * which opens the work order dialog from the ?job= URL param.
 */
export default function WorkOrderChip({ repairId, requestNumber, className = '' }) {
  if (!repairId || !requestNumber) return null;
  return (
    <Link
      to={`/admin/repair-tracker?tab=jobs&job=${repairId}`}
      onClick={(e) => e.stopPropagation()}
      title={`Open work order ${requestNumber}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary dark:text-blue-400 transition-colors whitespace-nowrap ${className}`}
    >
      <span className="material-symbols-outlined text-sm">build_circle</span>
      {requestNumber}
    </Link>
  );
}
