// Single source of truth for repair statuses, transitions, and stage config
// Used by RepairJobsTab, CustomersTab, and any future repair-related components

export const REPAIR_STATUSES = {
  received:      { label: 'Received',         color: 'bg-slate-700 text-slate-300 border-slate-600',         step: 1 },
  diagnosed:     { label: 'Diagnosed',         color: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',   step: 2 },
  quoted:        { label: 'Quoted',            color: 'bg-purple-900/30 text-purple-400 border-purple-700',   step: 3 },
  approved:      { label: 'Approved',          color: 'bg-green-900/30 text-green-400 border-green-700',      step: 4 },
  parts_pending: { label: 'Parts Pending',     color: 'bg-orange-900/30 text-orange-400 border-orange-700',   step: 5 },
  in_repair:     { label: 'In Repair',         color: 'bg-blue-900/30 text-blue-400 border-blue-700',         step: 6 },
  ready:         { label: 'Ready for Pickup',  color: 'bg-emerald-900/30 text-emerald-400 border-emerald-700', step: 7 },
  invoiced:      { label: 'Invoiced',          color: 'bg-teal-900/30 text-teal-400 border-teal-700',         step: 8 },
  // Off-ramps (step: null = not part of linear flow)
  declined:      { label: 'Declined',          color: 'bg-red-900/30 text-red-400 border-red-700',            step: null },
  completed:     { label: 'Completed',         color: 'bg-green-900/50 text-green-300 border-green-600',      step: null },
  abandoned:     { label: 'Abandoned',         color: 'bg-rose-900/30 text-rose-400 border-rose-700',         step: null },
  closed:        { label: 'Closed',            color: 'bg-slate-800/50 text-slate-400 border-slate-600',      step: null },
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
