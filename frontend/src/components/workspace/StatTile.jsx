import { Children, cloneElement } from 'react';

/**
 * A figure with its label and a one-line note — the period totals above the
 * Profit & Loss rows and the Journal. Never a control. The note line is
 * always rendered so a row of tiles keeps its figures on one baseline even
 * when one tile has nothing to add.
 */
export default function StatTile({ label, sub, tone = 'text-slate-900 dark:text-white', className = '', children }) {
  return (
    <div className={`min-w-0 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 ${className}`}>
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">{label}</span>
      <span className={`block text-base sm:text-xl font-black leading-tight truncate ${tone}`}>{children}</span>
      <span className="block text-[11px] leading-4 truncate text-slate-500 dark:text-slate-400">{sub || ' '}</span>
    </div>
  );
}

// Five tiles: two by two on phones and tablets (the fifth spans the row),
// three then two at laptop widths where the sidebar rail leaves ~650px,
// one row from xl.
const FIVE_SPANS = [
  'lg:col-span-2 xl:col-span-1',
  'lg:col-span-2 xl:col-span-1',
  'lg:col-span-2 xl:col-span-1',
  'lg:col-span-3 xl:col-span-1',
  'col-span-2 lg:col-span-3 xl:col-span-1',
];

/** The row of five StatTiles above a view's list. */
export function StatRow({ className = '', children }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-6 xl:grid-cols-5 gap-2 ${className}`}>
      {Children.toArray(children).map((child, i) => cloneElement(child, { className: FIVE_SPANS[i] || '' }))}
    </div>
  );
}
