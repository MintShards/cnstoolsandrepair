// Single source of truth for Shop Hub task statuses, priorities, recurrence,
// and section navigation — same config-map shape as repairStatuses.js.

export const TASK_STATUSES = {
  todo: {
    label: 'To Do',
    icon: 'radio_button_unchecked',
    color: 'bg-slate-200 text-slate-700 border-slate-400 dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-500',
    dot: 'bg-slate-500 dark:bg-slate-400',
  },
  in_progress: {
    label: 'In Progress',
    icon: 'autorenew',
    color: 'bg-blue-100 text-blue-800 border-blue-400 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-500',
    dot: 'bg-blue-500 dark:bg-blue-400',
  },
  done: {
    label: 'Done',
    icon: 'check_circle',
    color: 'bg-green-100 text-green-800 border-green-400 dark:bg-green-900/40 dark:text-green-300 dark:border-green-600',
    dot: 'bg-green-500 dark:bg-green-400',
  },
};

export const TASK_STATUS_LIST = Object.entries(TASK_STATUSES)
  .map(([value, cfg]) => ({ value, ...cfg }));

// Same palette as the repair jobs priority badges (standard/rush/urgent).
export const TASK_PRIORITIES = {
  normal: { label: 'Normal', color: 'bg-slate-200 text-slate-600 border-slate-400 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600', dot: 'bg-slate-400 dark:bg-slate-500' },
  high:   { label: 'High',   color: 'bg-orange-100 text-orange-700 border-orange-400 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700', dot: 'bg-orange-500 dark:bg-orange-400' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-400 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700', dot: 'bg-red-500 dark:bg-red-400' },
};

export const TASK_PRIORITY_LIST = Object.entries(TASK_PRIORITIES)
  .map(([value, cfg]) => ({ value, ...cfg }));

export const TASK_PRIORITY_RANK = { urgent: 3, high: 2, normal: 1 };

export const RECURRENCE_OPTIONS = [
  { value: 'none',    label: 'Does not repeat' },
  { value: 'daily',   label: 'Repeats daily' },
  { value: 'weekly',  label: 'Repeats weekly' },
  { value: 'monthly', label: 'Repeats monthly' },
];

export const RECURRENCE_LABELS = {
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
};

export const WORKSPACE_SECTIONS = [
  { id: 'my-tasks',  label: 'My Tasks',  icon: 'checklist' },
  { id: 'all-tasks', label: 'All Tasks', icon: 'list_alt' },
  { id: 'calendar',  label: 'Calendar',  icon: 'calendar_month' },
  { id: 'feed',      label: 'Shop Feed', icon: 'forum' },
  { id: 'staff',     label: 'Staff',     icon: 'group' },
];

export const WORKSPACE_SECTION_IDS = WORKSPACE_SECTIONS.map((s) => s.id);

// Deterministic avatar backgrounds — picked by user-id hash so each person
// keeps their colour everywhere without storing anything.
export const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-purple-500',
  'bg-rose-500', 'bg-cyan-600', 'bg-amber-500', 'bg-indigo-500',
];
