// The "Paid?" answer a status change to Completed carries, and the payment
// it turns into. Marking a tool Completed is when the customer usually pays,
// so the work order dialog's status modals ask right there instead of
// sending the admin to Cash Flow:
//   now      → a payment is logged on the work order once the status change
//              has gone through (amount prefilled, method, reference, date);
//   later    → nothing is logged; the work order stays owing until the money
//              lands and is logged from the dialog or Cash Flow (named "Pay
//              later", not "On account" — that is a payment method below it);
//   already  → nothing is logged (a deposit covered it, or it was logged).
// Nulls in the answer mean "not touched": the mode and the amount come from
// the job's figures until the admin edits them.
import { round2 } from './money';
import { getTodayPacific } from './dateFormat';
import { sumEntered } from './jobAccounting';

export const PAY_MODES = [
  { id: 'now', label: 'Paid now', icon: 'payments' },
  { id: 'later', label: 'Pay later', icon: 'schedule' },
  { id: 'already', label: 'Already paid', icon: 'check_circle' },
];

export const EMPTY_PAY = { mode: null, amount: null, method: '', reference: '', date: '' };

export const payAmount = (s) => {
  const v = parseFloat(String(s ?? '').replace(/[$,\s]/g, ''));
  return Number.isNaN(v) ? null : v;
};

/**
 * What to prefill for these tools: their invoice totals incl. tax, capped at
 * what the job still owes (a deposit logged earlier lowers it). `acct` is the
 * dialog's jobAccounting result; null (money not loaded, or not an admin)
 * gives no suggestion.
 */
export function suggestedPaymentFor(acct, toolIds) {
  if (!acct) return { suggested: null, balance: null };
  const ids = new Set(toolIds);
  const incl = sumEntered(acct.tools.filter((t) => ids.has(t.tool_id) && !t.excluded).map((t) => t.inclTax));
  const balance = acct.balance;
  let suggested = incl;
  if (suggested != null && balance != null) suggested = round2(Math.min(suggested, Math.max(balance, 0)));
  if (suggested == null && balance != null && balance > 0) suggested = balance;
  return { suggested, balance };
}

/** The answer with its blanks filled from the job: mode, amount and date. */
export function resolvePay(value, { suggested, balance }) {
  const mode = value.mode ?? (balance != null && balance <= 0 ? 'already' : 'now');
  const amount = value.amount ?? (suggested != null ? suggested.toFixed(2) : '');
  return { ...value, mode, amount, date: value.date || getTodayPacific() };
}

/** "Paid now" with no usable amount — the status change must wait. */
export function payInvalid(value, ctx) {
  const r = resolvePay(value, ctx);
  return r.mode === 'now' && !(payAmount(r.amount) > 0);
}

/** The payment to log for this answer, or null when none should be. */
export function paymentPayload(value, ctx, { customerName, jobId, zohoInvoiceNumber }) {
  const r = resolvePay(value, ctx);
  if (r.mode !== 'now') return null;
  const a = payAmount(r.amount);
  if (!(a > 0)) return null;
  return {
    customer_name: customerName,
    repair_id: jobId,
    zoho_invoice_number: zohoInvoiceNumber || null,
    amount: round2(a),
    currency: 'CAD',
    received_date: r.date || null,
    payment_method: r.method || null,
    payment_reference: r.reference.trim() || null,
    notes: 'Paid on completion',
  };
}
