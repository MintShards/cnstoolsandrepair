import { BILL_STATUSES } from '../../constants/bills';

/** Status pill for a bill — same look as the task status pills. */
export default function BillStatusPill({ status, small = false }) {
  const cfg = BILL_STATUSES[status] || BILL_STATUSES.unpaid;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded font-bold border whitespace-nowrap ${small ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-sm'} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
