// Activity kinds emitted by GET /api/activity, grouped for the calendar's
// day chips. Labels double as the printed report's event names.

export const ACTIVITY_GROUPS = {
  received: {
    label: 'Received',
    icon: 'inventory_2',
    chip: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  status: {
    label: 'Status changes',
    icon: 'sync_alt',
    chip: 'bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
  },
  tasks: {
    label: 'Tasks',
    icon: 'task_alt',
    chip: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  },
  edits: {
    label: 'Edits & other',
    icon: 'edit_note',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  // Cash Flow events only ever reach admins (the API filters them), so this
  // group simply never appears for anyone else.
  money: {
    label: 'Cash Flow',
    icon: 'account_balance_wallet',
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  },
  library: {
    label: 'Parts Library',
    icon: 'inventory',
    chip: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  },
  // Settings and account changes reach admins only (the API filters them);
  // diagnosis-code changes are shop-wide.
  admin: {
    label: 'Settings, accounts & codes',
    icon: 'admin_panel_settings',
    chip: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  },
};

export const ACTIVITY_KINDS = {
  job_created:      { label: 'New work order',      icon: 'add_box',       group: 'received' },
  tool_received:    { label: 'Tool received',       icon: 'inventory_2',   group: 'received' },
  request_received: { label: 'Online request',      icon: 'inbox',         group: 'received' },
  customer_created: { label: 'New customer',        icon: 'person_add',    group: 'received' },
  status_changed:   { label: 'Status change',       icon: 'sync_alt',      group: 'status' },
  task_created:     { label: 'Task created',        icon: 'add_task',      group: 'tasks' },
  task_completed:   { label: 'Task completed',      icon: 'task_alt',      group: 'tasks' },
  tool_edited:      { label: 'Tool edited',         icon: 'edit_note',     group: 'edits' },
  job_edited:       { label: 'Work order edited',   icon: 'edit_note',     group: 'edits' },
  customer_edited:  { label: 'Customer edited',     icon: 'edit_note',     group: 'edits' },
  customer_deleted: { label: 'Customer deleted',    icon: 'person_remove', group: 'edits' },
  job_deleted:      { label: 'Work order deleted',  icon: 'delete',        group: 'edits' },
  tool_removed:     { label: 'Tool removed',        icon: 'delete',        group: 'edits' },
  photos_added:     { label: 'Photos added',        icon: 'add_a_photo',   group: 'edits' },
  photo_removed:    { label: 'Photo removed',       icon: 'hide_image',    group: 'edits' },
  wo_email_sent:    { label: 'Work order emailed',  icon: 'outgoing_mail', group: 'edits' },
  bill_logged:         { label: 'Bill logged',          icon: 'receipt_long', group: 'money' },
  bill_paid:           { label: 'Bill paid',            icon: 'price_check',  group: 'money' },
  bill_status_changed: { label: 'Bill status change',   icon: 'sync_alt',     group: 'money' },
  bill_edited:         { label: 'Bill edited',          icon: 'edit_note',    group: 'money' },
  bill_deleted:        { label: 'Bill deleted',         icon: 'delete',       group: 'money' },
  payment_received:    { label: 'Payment received',     icon: 'payments',     group: 'money' },
  payment_edited:      { label: 'Payment edited',       icon: 'edit_note',    group: 'money' },
  payment_deleted:     { label: 'Payment deleted',      icon: 'delete',       group: 'money' },
  brand_added:         { label: 'Brand added',          icon: 'add_box',      group: 'library' },
  brand_edited:        { label: 'Brand edited',         icon: 'edit_note',    group: 'library' },
  brand_retired:       { label: 'Brand removed',        icon: 'delete',       group: 'library' },
  model_added:         { label: 'Model added',          icon: 'add_box',      group: 'library' },
  model_edited:        { label: 'Model edited',         icon: 'edit_note',    group: 'library' },
  model_retired:       { label: 'Model removed',        icon: 'delete',       group: 'library' },
  part_added:          { label: 'Part added',           icon: 'add_box',      group: 'library' },
  part_edited:         { label: 'Part edited',          icon: 'edit_note',    group: 'library' },
  part_retired:        { label: 'Part removed',         icon: 'delete',       group: 'library' },
  part_fits_changed:   { label: 'Part fit changed',     icon: 'link',         group: 'library' },
  stock_adjusted:      { label: 'Stock adjusted',       icon: 'tune',         group: 'library' },
  settings_changed:    { label: 'Settings saved',       icon: 'settings',     group: 'admin' },
  account_created:     { label: 'Account created',      icon: 'person_add',   group: 'admin' },
  account_edited:      { label: 'Account edited',       icon: 'manage_accounts', group: 'admin' },
  account_deactivated: { label: 'Account deactivated',  icon: 'person_off',   group: 'admin' },
  account_reactivated: { label: 'Account re-activated', icon: 'person_check', group: 'admin' },
  account_role_changed: { label: 'Access changed',      icon: 'admin_panel_settings', group: 'admin' },
  password_changed:    { label: 'Password changed',     icon: 'key',          group: 'admin' },
  code_added:          { label: 'Diagnosis code added', icon: 'troubleshoot', group: 'admin' },
  code_edited:         { label: 'Diagnosis code edited', icon: 'edit_note',   group: 'admin' },
  code_retired:        { label: 'Diagnosis code retired', icon: 'delete',     group: 'admin' },
  code_restored:       { label: 'Diagnosis code restored', icon: 'restore',   group: 'admin' },
};

export const ACTIVITY_GROUP_ORDER = ['received', 'status', 'tasks', 'edits', 'money', 'library', 'admin'];

export function activityKind(kind) {
  return ACTIVITY_KINDS[kind] || { label: kind, icon: 'info', group: 'edits' };
}

/** { received: n, status: n, tasks: n, edits: n } for a list of events. */
export function countByGroup(events) {
  const counts = {};
  for (const e of events || []) {
    const g = activityKind(e.kind).group;
    counts[g] = (counts[g] || 0) + 1;
  }
  return counts;
}
