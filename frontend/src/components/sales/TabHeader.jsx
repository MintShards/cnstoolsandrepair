/**
 * The opening block of every tab: what this screen is, one line of context,
 * the tab's single primary action, and an optional row of filters.
 *
 * One component because five tabs render this shape. Layout follows the
 * Repair Tracker's header recipe: title and action share ONE row on every
 * size (flex-wrap catches overly wide action clusters), and phone filters
 * sit in a two-up grid instead of a stack of full-width lines — the old
 * stacked layout pushed content ~350px down the screen before anything
 * useful appeared. Direct <input> children (search boxes) span both grid
 * columns; selects and buttons take half each.
 */
export default function TabHeader({ title, subtitle, action, children }) {
  // Embedded uses (a zone screen's run history) supply filters but no title —
  // the screen above already named them, so the row is skipped entirely
  // rather than reserving space for an empty heading.
  const hasTitleRow = title || action;

  return (
    <div className="mb-5">
      {hasTitleRow && (
        <div className="flex flex-row items-center justify-between flex-wrap gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action}
        </div>
      )}

      {children && (
        <div className={`grid grid-cols-2 gap-2 [&>input]:col-span-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5 ${hasTitleRow ? 'mt-4' : ''}`}>
          {children}
        </div>
      )}
    </div>
  );
}
