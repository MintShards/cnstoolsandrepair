// Shared chrome for the sales surfaces, matched to the repair tracker's look:
// neutral slate boxes, semantic colour only as a status dot or on hover, and
// at most one solid-primary action per view.

export const ICON_BTN = 'w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 border border-slate-200 hover:border-slate-300 dark:border-slate-600/50 dark:hover:border-slate-500 text-slate-500 dark:text-slate-400 rounded-lg transition-all';

export const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl text-sm font-bold transition-all';

export const BTN_NEUTRAL = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl text-sm font-bold transition-all';

export const INTEREST_META = {
  hot:  { label: 'Hot',  dot: 'bg-red-500' },
  warm: { label: 'Warm', dot: 'bg-orange-400' },
  cold: { label: 'Cold', dot: 'bg-blue-400' },
};

// Selector order for interest pickers (coldest first).
export const INTEREST_LEVELS = ['cold', 'warm', 'hot'];
