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
      // before: halo lifts the ~30px pill to a 44px+ tap target on phones
      // without changing its look; hidden from sm up.
      className={`relative before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[''] sm:before:hidden inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary dark:text-blue-400 transition-colors whitespace-nowrap ${className}`}
    >
      <span className="material-symbols-outlined text-sm">build_circle</span>
      {requestNumber}
    </Link>
  );
}
