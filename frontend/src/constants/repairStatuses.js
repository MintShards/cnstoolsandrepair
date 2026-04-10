// Single source of truth for repair statuses, transitions, and stage config
// Used by RepairJobsTab, CustomersTab, and any future repair-related components

export const REPAIR_STATUSES = {
  received:      { label: 'Received',         color: 'bg-slate-200 text-slate-700 border-slate-400 dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-500',                      dot: 'bg-slate-500 dark:bg-slate-400',          step: 1 },
  diagnosed:     { label: 'Diagnosed',         color: 'bg-yellow-100 text-yellow-800 border-yellow-400 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-600',               dot: 'bg-yellow-500 dark:bg-yellow-400',         step: 2 },
  quoted:        { label: 'Quoted',            color: 'bg-purple-100 text-purple-800 border-purple-400 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-600',               dot: 'bg-purple-500 dark:bg-purple-400',         step: 3 },
  approved:      { label: 'Approved',          color: 'bg-green-100 text-green-800 border-green-400 dark:bg-green-900/40 dark:text-green-300 dark:border-green-600',                     dot: 'bg-green-500 dark:bg-green-400',           step: 4 },
  parts_pending: { label: 'Parts Pending',     color: 'bg-orange-100 text-orange-800 border-orange-400 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-600',               dot: 'bg-orange-500 dark:bg-orange-400',         step: 5 },
  in_repair:     { label: 'In Repair',         color: 'bg-blue-100 text-blue-800 border-blue-400 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-500',                           dot: 'bg-blue-500 dark:bg-blue-400',             step: 6 },
  ready:         { label: 'Ready for Pickup',  color: 'bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-600',          dot: 'bg-emerald-500 dark:bg-emerald-400',       step: 7 },
  invoiced:      { label: 'Invoiced',          color: 'bg-teal-100 text-teal-800 border-teal-400 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-600',                           dot: 'bg-teal-500 dark:bg-teal-400',             step: 8 },
  // Off-ramps (step: null = not part of linear flow)
  declined:      { label: 'Declined',          color: 'bg-red-100 text-red-800 border-red-400 dark:bg-red-900/40 dark:text-red-300 dark:border-red-600',                                 dot: 'bg-red-500 dark:bg-red-400',               step: null },
  completed:     { label: 'Completed',         color: 'bg-green-200 text-green-900 border-green-500 dark:bg-green-800/60 dark:text-green-200 dark:border-green-500',                     dot: 'bg-green-600 dark:bg-green-300',           step: null },
  abandoned:     { label: 'Abandoned',         color: 'bg-rose-100 text-rose-800 border-rose-400 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-600',                           dot: 'bg-rose-500 dark:bg-rose-400',             step: null },
  closed:        { label: 'Closed',            color: 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-600',                     dot: 'bg-slate-400 dark:bg-slate-500',           step: null },
};

// Flat array for dropdowns and iteration
export const REPAIR_STATUSES_LIST = Object.entries(REPAIR_STATUSES)
  .map(([value, cfg]) => ({ value, ...cfg }));

// Ordered linear stages for the progress stepper
export const MAIN_STAGES = [
  'received', 'diagnosed', 'quoted', 'approved',
  'parts_pending', 'in_repair', 'ready', 'invoiced',
];

// Valid next statuses for each status (enforced on backend too)
export const ALLOWED_TRANSITIONS = {
  received:      ['diagnosed', 'abandoned'],
  diagnosed:     ['quoted', 'received', 'abandoned'],
  quoted:        ['approved', 'declined', 'diagnosed', 'abandoned'],
  approved:      ['parts_pending', 'in_repair', 'quoted', 'abandoned'],
  declined:      ['closed', 'abandoned'],
  parts_pending: ['in_repair', 'quoted', 'approved', 'abandoned'],
  in_repair:     ['ready', 'parts_pending', 'approved', 'abandoned'],
  ready:         ['invoiced', 'in_repair', 'abandoned'],
  invoiced:      ['completed', 'ready', 'abandoned'],
  completed:     ['closed'],
  abandoned:     ['closed'],
  closed:        [],
};

/** Returns the list of valid next status values from a given status */
export const getValidNextStatuses = (currentStatus) =>
  ALLOWED_TRANSITIONS[currentStatus] || [];

/** Returns { current: N, total: 8 } for linear stages, null for off-ramps */
export const getStepInfo = (status) => {
  const cfg = REPAIR_STATUSES[status];
  if (!cfg || cfg.step === null) return null;
  return { current: cfg.step, total: MAIN_STAGES.length };
};
