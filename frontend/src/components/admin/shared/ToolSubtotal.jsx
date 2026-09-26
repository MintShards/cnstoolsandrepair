import { formatMoney } from '../../../utils/money';
import { profitTone } from '../../../utils/jobAccounting';
import AccountingStatement from './AccountingStatement';

// A figure nobody has entered shows as "—", so a real $0.00 stays distinct.
const money = (v) => (v == null ? '—' : formatMoney(v));

/**
 * One tool's own statement, under its details: what the customer is charged
 * for it (everyone), and for admins what it cost the shop and the profit.
 * Same three columns as the job's statement at the top; payments belong to
 * the job, so there is no payment line here. `acct` is this tool's entry
 * from jobAccounting(), null for non-admins or while it loads.
 */
export default function ToolSubtotal({ index, charges, acct, isAdmin, excludedReason = null }) {
  const hasCost = Boolean(acct && (acct.cost.total != null || acct.cost.lines.length > 0 || acct.cost.uncostedParts > 0));
  if (charges.subtotal == null && charges.invoiced == null && !hasCost) return null;

  const charged = {
    title: 'Charged to customer',
    rows: [
      {
        label: 'Labour charged',
        value: money(charges.labour),
        hint: charges.labour != null ? `${charges.hours} h × ${formatMoney(charges.rate)}` : 'Needs labour hours and an hourly rate on the tool',
      },
      { label: 'Parts charged', value: money(charges.parts), hint: 'Parts at the customer’s price' },
      { label: 'Extra charged', value: money(charges.extras) },
      {
        label: charges.invoiced != null ? 'Revenue (invoiced)' : 'Revenue',
        value: money(charges.revenue),
        strong: true,
        hint: charges.invoiced != null ? 'The pre-tax invoiced amount typed on this tool' : 'Labour + parts + extra charged, before tax',
      },
    ],
  };
  const admin = Boolean(isAdmin && acct);
  const cost = admin ? {
    title: 'Cost to shop',
    rows: [
      // Same order as the charged column: labour, parts, then the rest.
      {
        label: 'Labour cost',
        value: money(acct.cost.labour),
        hint: acct.cost.labour != null
          ? `${charges.hours} h × ${formatMoney(acct.cost.labourRate)}${acct.cost.ownLabourRate ? ' (this tool’s rate)' : ' (shop rate)'}`
          : acct.cost.labourRate == null ? 'No labour cost rate set' : 'Needs labour hours on the tool',
      },
      { label: 'Parts cost', value: money(acct.cost.parts), hint: 'Installed parts at what they cost the shop — each part’s cost, from the parts library' },
      { label: 'Other cost', value: money(acct.cost.other), hint: 'Freight, outsourced work and other expenses logged for this tool' },
      { label: 'Total cost', value: money(acct.cost.total), strong: true },
    ],
  } : null;
  // The subtraction spelled out, same as the job's statement.
  const profit = admin ? {
    title: 'Profit',
    rows: [
      { label: 'Revenue', value: money(charges.revenue), hint: 'The first column’s total' },
      { label: 'Total cost', value: money(acct.cost.total), hint: 'The second column’s total' },
      { label: 'Profit', value: money(acct.profit), strong: true, tone: profitTone(acct.profit), hint: 'Revenue minus total cost, before tax' },
      { label: 'Margin', value: acct.margin != null ? `${acct.margin}% of revenue` : '—', tone: profitTone(acct.profit), hint: 'Profit as a share of this tool’s revenue' },
    ],
  } : null;

  return (
    <div className="mt-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
        Tool {index} accounting
        {excludedReason && (
          <span className="ml-2 normal-case tracking-normal font-bold text-amber-700 dark:text-amber-400">· {excludedReason} — not counted in the job’s figures</span>
        )}
      </p>
      <div className={excludedReason ? 'opacity-60' : ''}>
        <AccountingStatement columns={[charged, cost, profit]} />
      </div>
      {charges.invoiced != null && charges.invoiced !== charges.subtotal && (
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">Invoiced amount used in place of the tracker’s own figures ({money(charges.subtotal)}).</p>
      )}
      {admin && acct.cost.labour == null && acct.cost.labourRate != null && (
        <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">Labour cost needs labour hours on this tool — the rate alone ({formatMoney(acct.cost.labourRate)}/h) has nothing to multiply.</p>
      )}
      {admin && acct.cost.uncostedParts > 0 && (
        <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">{acct.cost.uncostedParts} installed part{acct.cost.uncostedParts === 1 ? '' : 's'} without a cost in the parts library — left out of the parts cost.</p>
      )}
      {admin && acct.cost.pendingParts > 0 && (
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">{acct.cost.pendingParts} part{acct.cost.pendingParts === 1 ? '' : 's'} not installed yet — cost counts once installed.</p>
      )}
      {admin && acct.cost.unpriced > 0 && (
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">{acct.cost.unpriced} bill line{acct.cost.unpriced === 1 ? '' : 's'} without a price left out.</p>
      )}
    </div>
  );
}
