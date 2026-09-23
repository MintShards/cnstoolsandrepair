import { Link } from 'react-router-dom';
import { ACTIVITY_GROUPS } from '../../constants/activity';

/**
 * Clickable bill / payment pill — the Cash Flow twin of WorkOrderChip. Deep-
 * links into the Workspace's Cash Flow section, which opens the record from
 * the ?bill= / ?payment= URL param. Colours come from the activity "money"
 * group so calendar day chips and these links read as one family.
 */
export default function CashFlowChip({ billId, paymentId, number, className = '' }) {
  if (!(billId || paymentId) || !number) return null;
  const param = billId ? `bill=${billId}` : `payment=${paymentId}`;
  return (
    <Link
      to={`/workspace?section=cash-flow&${param}`}
      onClick={(e) => e.stopPropagation()}
      title={`Open ${number} in Cash Flow`}
      // before: halo lifts the ~30px pill to a 44px+ tap target on phones
      // without changing its look; hidden from sm up.
      className={`relative before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[''] sm:before:hidden inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border border-violet-300/70 dark:border-violet-700/50 hover:opacity-80 transition-opacity whitespace-nowrap ${ACTIVITY_GROUPS.money.chip} ${className}`}
    >
      <span className="material-symbols-outlined text-sm">{billId ? 'receipt_long' : 'payments'}</span>
      {number}
    </Link>
  );
}
