// Single source of truth for repair statuses, transitions, and stage config
// Used by RepairJobsTab, CustomersTab, and any future repair-related components

export const REPAIR_STATUSES = {
  received:      { label: 'Received',         color: 'bg-slate-700/60 text-slate-200 border-slate-500',          dot: 'bg-slate-400',     step: 1 },
  diagnosed:     { label: 'Diagnosed',         color: 'bg-yellow-900/40 text-yellow-300 border-yellow-600',       dot: 'bg-yellow-400',    step: 2 },
  quoted:        { label: 'Quoted',            color: 'bg-purple-900/40 text-purple-300 border-purple-600',       dot: 'bg-purple-400',    step: 3 },
  approved:      { label: 'Approved',          color: 'bg-green-900/40 text-green-300 border-green-600',          dot: 'bg-green-400',     step: 4 },
  parts_pending: { label: 'Parts Pending',     color: 'bg-orange-900/40 text-orange-300 border-orange-600',       dot: 'bg-orange-400',    step: 5 },
  in_repair:     { label: 'In Repair',         color: 'bg-blue-900/40 text-blue-300 border-blue-500',             dot: 'bg-blue-400',      step: 6 },
  ready:         { label: 'Ready for Pickup',  color: 'bg-emerald-900/40 text-emerald-300 border-emerald-600',    dot: 'bg-emerald-400',   step: 7 },
  invoiced:      { label: 'Invoiced',          color: 'bg-teal-900/40 text-teal-300 border-teal-600',             dot: 'bg-teal-400',      step: 8 },
  // Off-ramps (step: null = not part of linear flow)
  declined:      { label: 'Declined',          color: 'bg-red-900/40 text-red-300 border-red-600',                dot: 'bg-red-400',       step: null },
  completed:     { label: 'Completed',         color: 'bg-green-800/60 text-green-200 border-green-500',          dot: 'bg-green-300',     step: null },
  abandoned:     { label: 'Abandoned',         color: 'bg-rose-900/40 text-rose-300 border-rose-600',             dot: 'bg-rose-400',      step: null },
  closed:        { label: 'Closed',            color: 'bg-slate-800/60 text-slate-400 border-slate-600',          dot: 'bg-slate-500',     step: null },
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
