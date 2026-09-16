// Single source of truth for the Bills section (supplier bills & receipts):
// statuses, categories, payment methods, filter chips — same config-map
// shape as workspace.js / repairStatuses.js.

export const BILL_STATUSES = {
  unpaid: {
    label: 'Unpaid',
    icon: 'schedule',
    color: 'bg-amber-100 text-amber-800 border-amber-400 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  paid: {
    label: 'Paid',
    icon: 'check_circle',
    color: 'bg-green-100 text-green-800 border-green-400 dark:bg-green-900/40 dark:text-green-300 dark:border-green-600',
    dot: 'bg-green-500 dark:bg-green-400',
  },
  disputed: {
    label: 'Disputed',
    icon: 'report',
    color: 'bg-red-100 text-red-700 border-red-400 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
    dot: 'bg-red-500 dark:bg-red-400',
  },
  void: {
    label: 'Void',
    icon: 'block',
    color: 'bg-slate-200 text-slate-600 border-slate-400 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
    dot: 'bg-slate-400 dark:bg-slate-500',
  },
};

export const BILL_STATUS_LIST = Object.entries(BILL_STATUSES)
  .map(([value, cfg]) => ({ value, ...cfg }));

export const BILL_CATEGORIES = {
  parts: 'Parts',
  consumables: 'Consumables',
  tools_equipment: 'Tools & equipment',
  services: 'Services',
  other: 'Other',
};

export const BILL_CATEGORY_LIST = Object.entries(BILL_CATEGORIES)
  .map(([value, label]) => ({ value, label }));

export const PAYMENT_METHODS = {
  card: 'Card',
  e_transfer: 'E-transfer',
  cheque: 'Cheque',
  cash: 'Cash',
  account: 'On account',
};

export const PAYMENT_METHOD_LIST = Object.entries(PAYMENT_METHODS)
  .map(([value, label]) => ({ value, label }));

export const CURRENCIES = ['CAD', 'USD'];

// BC sales taxes, for the "Calculate from subtotal" helper only — the bill
// keeps whatever the supplier actually charged.
export const GST_RATE = 0.05;
export const PST_RATE = 0.07;

// Filter chips → list params. Unpaid is the working view; Overdue narrows it
// (unpaid + past due); All lifts the default non-void filter.
export const BILL_CHIPS = [
  { id: 'unpaid',   label: 'Unpaid',   params: { status: 'unpaid' } },
  { id: 'overdue',  label: 'Overdue',  params: { overdue: true } },
  { id: 'disputed', label: 'Disputed', params: { status: 'disputed' } },
  { id: 'paid',     label: 'Paid',     params: { status: 'paid' } },
  { id: 'all',      label: 'All',      params: { status: 'all' } },
];

export const BILL_CHIP_IDS = BILL_CHIPS.map((c) => c.id);

/** Overdue is derived, never stored: unpaid and past its due date. */
export function isBillOverdue(bill, today) {
  return bill.status === 'unpaid' && Boolean(bill.due_date) && bill.due_date < today;
}

/** Distinct work orders linked from a bill's lines, as WorkOrderChip props. */
export function linkedWorkOrders(bill) {
  const seen = new Map();
  for (const line of bill?.lines || []) {
    if (line.repair_id && line.request_number && !seen.has(line.repair_id)) {
      seen.set(line.repair_id, line.request_number);
    }
  }
  return [...seen.entries()].map(([repair_id, request_number]) => ({ repair_id, request_number }));
}
