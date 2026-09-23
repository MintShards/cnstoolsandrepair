// Form control classes shared by the Workspace modals, matched to VisitLogger.
// Phone-first sizing: 16px text below sm (iOS Safari zooms the page when a
// control under 16px gets focus) and 44px action buttons; sm+ restores the
// desktop look.
const INPUT_BASE = 'w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors';

export const INPUT_CLS = `${INPUT_BASE} text-base sm:text-sm`;

// The one big number on a money form (amount received, bill total). Its own
// string rather than sizes appended after INPUT_CLS — appended utilities can
// lose to the base ones depending on Tailwind's emit order (see CLAUDE.md,
// "cascade trap").
export const AMOUNT_INPUT_CLS = `${INPUT_BASE} text-lg sm:text-base font-black`;

export const LABEL_CLS = 'block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5';

export const CANCEL_BTN_CLS = 'flex-1 py-2.5 min-h-[44px] sm:min-h-0 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 text-sm';

export const SUBMIT_BTN_CLS = 'flex-1 py-2.5 min-h-[44px] sm:min-h-0 bg-primary hover:bg-blue-500 text-white font-black rounded-xl transition-colors text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed';

// Choice pills (currency, paid-by method) on the Cash Flow forms. Full size is
// a 44px tap target on phones. `compact` keeps the pill small beside a field
// label and lifts its hit area with an invisible halo instead (the
// WorkOrderChip trick) — appending px-2.5 / min-h-0 over the full size would
// silently lose to the cascade.
const PILL_BASE = 'inline-flex items-center justify-center rounded-xl border-2 font-bold uppercase transition-all';
const PILL_FULL = 'px-3 py-2 min-h-[44px] sm:min-h-0 text-xs';
const PILL_COMPACT = "relative px-2.5 py-1 text-[11px] before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[''] sm:before:hidden";

export function pillCls(active, { compact = false } = {}) {
  return `${PILL_BASE} ${compact ? PILL_COMPACT : PILL_FULL} ${active
    ? 'border-primary bg-primary/5 text-slate-900 dark:text-white'
    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`;
}
