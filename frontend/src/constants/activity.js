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
};

export const ACTIVITY_GROUP_ORDER = ['received', 'status', 'tasks', 'edits'];

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
