import { Link } from 'react-router-dom';
import { formatMoney } from '../../../utils/money';
import { profitTone, sumEntered } from '../../../utils/jobAccounting';
import { BILL_LINE_KINDS } from '../../../constants/bills';
import BillStatusPill from '../../workspace/BillStatusPill';
import { Column } from './AccountingStatement';

// On phones the three buttons sit in a grid and fill their cells, so the
// icon and label are centred; on wider screens they size to their content.
const BTN = 'inline-flex items-center justify-center sm:justify-start gap-1 px-2 sm:px-2.5 py-1 min-h-[44px] sm:min-h-0 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-[13px] sm:text-xs font-bold transition-all';
// A figure nobody has entered shows as "—", so a real $0.00 stays distinct.
// (Not called `money`: the component's prop of that name would shadow it.)
const fmtMoney = (v) => (v == null ? '—' : formatMoney(v));

const LIST_HDR = 'text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400';
const LIST = 'rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 divide-y divide-slate-200 dark:divide-slate-700/40';
const PANEL = 'rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-700/40 px-3 py-2';
const NOTE = 'text-[11px] text-slate-500 dark:text-slate-400';
const WARN = 'text-[11px] text-amber-700 dark:text-amber-400';
const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

/**
 * Has the customer paid? Kept apart from the statement because it answers a
 * different question: the statement is pre-tax and about profit, while a
 * payment is real money with tax on it. The invoice total is revenue plus
 * GST and PST per each tool's tax status, so a customer who paid the whole
 * Zoho invoice reads as paid in full rather than overpaid by the tax.
 */
function PaymentLine({ acct }) {
  const t = acct.totals;
  const received = acct.received;
  const taxBits = [t.gst > 0 ? `GST ${formatMoney(t.gst)}` : null, t.pst > 0 ? `PST ${formatMoney(t.pst)}` : null].filter(Boolean);
  const invoicedHint = t.invoicedInclTax == null
    ? 'Needs revenue first'
    : taxBits.length ? `${formatMoney(t.revenue)} + ${taxBits.join(' + ')}` : `${formatMoney(t.revenue)}, no tax`;
  let balance;
  if (acct.balance == null) {
    balance = { label: 'Balance', value: '—', tone: '' };
  } else if (Math.abs(acct.balance) < 0.005) {
    balance = t.invoicedInclTax > 0
      ? { label: 'Balance', value: 'Paid in full', tone: 'text-green-700 dark:text-green-400' }
      : { label: 'Balance', value: formatMoney(0), tone: '' };
  } else if (acct.balance > 0) {
    balance = { label: 'Balance due', value: formatMoney(acct.balance), tone: '' };
  } else {
    balance = { label: 'Overpaid', value: formatMoney(-acct.balance), tone: 'text-amber-700 dark:text-amber-400', hint: 'Payments exceed the invoice total — a deposit ahead of pricing, or a figure to check' };
  }
  const cells = [
    { label: 'Invoiced incl. tax', value: fmtMoney(t.invoicedInclTax), tone: '', hint: invoicedHint },
    { label: 'Paid by customer', value: fmtMoney(received), tone: received != null ? 'text-green-700 dark:text-green-400' : '', hint: 'Customer payments logged in Cash Flow' },
    { ...balance, hint: balance.hint || 'Invoice total minus what the customer has paid' },
  ];
  // Three cells side by side from sm up; on phones each is a label/value row,
  // since three 100px columns would truncate the labels and "Paid in full".
  return (
    <div className={`${PANEL} grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2`}>
      {cells.map((c) => (
        <div key={c.label} className="min-w-0 flex items-baseline justify-between gap-3 sm:block" title={c.hint}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:truncate">{c.label}</p>
          <p className={`text-sm font-black tabular-nums whitespace-nowrap sm:truncate ${c.tone || 'text-slate-900 dark:text-white'}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * The bill lines behind "Other cost" — freight, outsourced work, anything
 * the shop paid for this job that is not a part — with who was paid, the
 * kind, which tool, and the amount. Each row opens its bill in Cash Flow.
 * Parts are not listed here: they are counted from each tool's installed
 * parts at cost, not from the supplier bill. Tool lines first in tool order,
 * then the whole-job lines.
 */
function ExpenseList({ acct }) {
  const rows = [];
  acct.tools.forEach((t, i) => t.cost.lines.forEach((l) => rows.push({ ...l, where: `Tool ${i + 1}`, order: i, excluded: t.excluded, reason: t.excludedReason })));
  acct.shared.lines.forEach((l) => rows.push({ ...l, where: 'Whole job', order: acct.tools.length, excluded: false }));
  if (!rows.length) return null;
  rows.sort((a, b) => a.order - b.order);
  // Lines on excluded tools are listed for the record but not added in.
  const notCounted = sumEntered(rows.filter((r) => r.excluded).map((r) => r.line_total));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className={LIST_HDR}>Other expenses on this job ({rows.length})</p>
        <p className="hidden sm:block text-[11px] text-slate-400 dark:text-slate-500 truncate">each line opens its bill in Cash Flow</p>
      </div>
      {/* Two lines per row: what and how much, then who / kind / tool / bill
          with the status pill. Keeps the description readable on a phone,
          where a pill and an amount beside it left "Hammer cag…". */}
      <ul className={LIST}>
        {rows.map((r, i) => (
          <li key={`${r.bill_id}-${i}`} className={r.excluded ? 'opacity-60' : ''}>
            <Link
              to={`/workspace?section=cash-flow&bill=${r.bill_id}`}
              className="block px-3 py-2 min-h-[44px] sm:min-h-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              title={`Open ${r.bill_number} in Cash Flow`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-xs font-bold text-slate-900 dark:text-white">
                  {r.description}{r.part_number ? ` · ${r.part_number}` : ''}
                </span>
                <span className={`text-xs font-black tabular-nums whitespace-nowrap ${r.excluded ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-white'}`}>
                  {r.line_total != null ? formatMoney(r.line_total) : <span className="font-medium text-slate-400 no-underline">no price</span>}
                </span>
              </span>
              <span className="mt-0.5 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {r.supplier_name} · {BILL_LINE_KINDS[r.kind] || r.kind} · {r.where}
                  {r.quantity !== 1 && r.unit_price != null ? ` · ${r.quantity} × ${formatMoney(r.unit_price)}` : ''}
                  {' · '}<span className="font-mono">{r.bill_number}</span>
                  {r.excluded && <span className="ml-1 text-amber-700 dark:text-amber-400">· {r.reason} — not counted</span>}
                </span>
                <BillStatusPill status={r.bill_status} small />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {notCounted != null && (
        <p className="mt-1 text-[11px] text-right text-slate-500 dark:text-slate-400">Not counted: {formatMoney(notCounted)} on tools left out of the figures</p>
      )}
    </div>
  );
}

/**
 * Job accounting, admin only (the parent decides whether to render this and
 * computes `acct` with jobAccounting()). The job's totals as a short
 * statement — what the customer is charged, what the job cost the shop, and
 * the profit, with the payment line under it — and each tool's own figures
 * under its parts list. The statement is before tax; Zoho Books keeps the
 * real invoice. The buttons add an extra charge to a tool, log an additional
 * expense (a Cash Flow bill) or a customer payment; the records themselves
 * live in Cash Flow.
 */
export default function WorkOrderMoney({ money, acct, onAddCharge, onAddExpense, onLogPayment }) {
  const { loaded, failed } = money;
  const t = acct?.totals;
  const empty = loaded && acct && !acct.hasBills && !acct.hasPayments && !acct.hasCharges;
  const multi = (acct?.tools.length || 0) > 1;

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
      {/* Title left, actions right; on phones the actions take their own
          full-width row under the title. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-slate-500 dark:text-slate-400" style={{ fontSize: '14px' }}>account_balance_wallet</span>
          <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Job accounting</h4>
        </div>
        {/* Parts bills are logged in Cash Flow (Workspace) and point back
            here; the things logged from this side are an extra charge on a
            tool, an additional expense on the job, and a customer payment. */}
        {/* Phones: a two-column grid of equal buttons, the lone third one
            spanning both columns; wider screens: the inline row. */}
        <div className="grid grid-cols-2 gap-1.5 [&>:last-child:nth-child(odd)]:col-span-2 sm:flex sm:flex-wrap sm:items-center sm:ml-auto sm:justify-end">
          <button type="button" onClick={onAddCharge} className={BTN} title="Add an extra charge to a tool — shop supplies, freight billed on, a fee: anything the customer pays beyond labour and parts">
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>sell</span>
            Add charge
          </button>
          <button type="button" onClick={onAddExpense} className={BTN} title="Add an additional expense — courier, outsourced work, anything the shop paid for this job; saved to Cash Flow">
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>add_circle</span>
            Add expense
          </button>
          <button type="button" onClick={onLogPayment} className={BTN} title="Log a customer payment for this job">
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>payments</span>
            Log a payment
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {failed ? (
          <p className="text-sm text-red-600 dark:text-red-400">Could not load this job’s bills and payments.</p>
        ) : !loaded || !acct ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>
        ) : empty ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">Nothing priced or logged yet — set labour and parts on the tools, and use the buttons above for other expenses and payments.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Column
                title="Charged to customer"
                rows={[
                  { label: 'Labour charged', value: fmtMoney(t.labourCharged) },
                  { label: 'Parts charged', value: fmtMoney(t.partsCharged) },
                  { label: 'Extra charged', value: fmtMoney(t.extraCharged) },
                  {
                    label: t.invoiced ? 'Revenue (invoiced)' : 'Revenue',
                    value: fmtMoney(t.revenue),
                    strong: true,
                    hint: t.invoiced ? 'Includes the invoiced amounts typed on tools, in place of their tracker figures' : 'Labour + parts + extra charged, before tax',
                  },
                ]}
              />
              <Column
                title="Cost to shop"
                rows={[
                  // Same order as the charged column: labour, parts, then the rest.
                  { label: 'Labour cost', value: fmtMoney(t.labourCost), hint: 'What the technicians’ work cost the shop — hours × their hourly rate, or their flat rate per job' },
                  { label: 'Parts cost', value: fmtMoney(t.partsCost), hint: 'The tools’ parts at what they cost the shop — each part’s cost, from the parts library' },
                  { label: 'Other cost', value: fmtMoney(t.otherCost), hint: 'Freight, outsourced work and other expenses logged for this job' },
                  { label: 'Total cost', value: fmtMoney(t.totalCost), strong: true },
                ]}
              />
              {/* The subtraction spelled out, so profit needs no inferring
                  from the other two columns. */}
              <Column
                title="Profit"
                rows={[
                  { label: 'Revenue', value: fmtMoney(t.revenue), hint: 'The first column’s total' },
                  { label: 'Total cost', value: fmtMoney(t.totalCost), hint: 'The second column’s total' },
                  { label: 'Profit', value: fmtMoney(t.profit), strong: true, tone: profitTone(t.profit), hint: 'Revenue minus total cost, before tax' },
                  { label: 'Margin', value: t.margin != null ? `${t.margin}% of revenue` : '—', tone: profitTone(t.profit), hint: 'Profit as a share of revenue' },
                ]}
              />
            </div>

            <PaymentLine acct={acct} />

            <ExpenseList acct={acct} />

            {multi && (
              <p className={NOTE}>
                Each tool’s own figures are under its parts list below
                {acct.shared.total > 0 ? ` · ${formatMoney(acct.shared.total)} of the cost belongs to the whole job rather than one tool` : ''}.
              </p>
            )}
            {acct.excluded.map((x) => (
              <p key={x.tool_id} className={NOTE}>
                <span className="font-bold text-slate-600 dark:text-slate-300">{x.label}</span> is {x.reason} — left out of the figures
                {x.cost != null && x.cost > 0 ? `; its ${formatMoney(x.cost)} of costs is not counted` : ''}.
              </p>
            ))}
            {t.labourCharged != null && t.labourCost == null && (
              <p className={WARN}>Labour cost is not counted: the assigned technician has no agreed labour cost yet — set it in Admin Settings → Users & Accounts, per hour or per job (the shop’s hourly rate in Repair Tracker settings is the fallback).</p>
            )}
            {acct.uncostedParts > 0 && (
              <p className={WARN}>{acct.uncostedParts} {plural(acct.uncostedParts, 'part')} {plural(acct.uncostedParts, 'has', 'have')} no cost yet — give the part a cost in the parts library and save the tool again; until then {plural(acct.uncostedParts, 'it is', 'they are')} left out of the parts cost.</p>
            )}
            {acct.unpriced > 0 && (
              <p className={NOTE}>{acct.unpriced} expense {plural(acct.unpriced, 'line')} for this job {plural(acct.unpriced, 'carries', 'carry')} no price yet and {plural(acct.unpriced, 'is', 'are')} left out of the costs.</p>
            )}
            {acct.foreign > 0 && (
              <p className={WARN}>{acct.foreign} {plural(acct.foreign, 'record')} on this job {plural(acct.foreign, 'is', 'are')} in another currency and not counted — these figures are CAD only.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
