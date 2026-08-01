/**
 * The opening block of every tab: what this screen is, one line of context,
 * the tab's single primary action, and an optional row of filters.
 *
 * One component because five tabs render this shape. When each owned a copy
 * they drifted, and below `sm` the action collapsed to an unlabelled icon
 * floating beside the title while the filters wrapped into a ragged pile on
 * the left. Stacked-then-row fixes both: on a phone the action is a full
 * width, labelled button and every filter is its own full-width line.
 */
export default function TabHeader({ title, subtitle, action, children }) {
  // Embedded uses (a zone screen's run history) supply filters but no title —
  // the screen above already named them, so the row is skipped entirely
  // rather than reserving space for an empty heading.
  const hasTitleRow = title || action;

  return (
    <div className="mb-5">
      {hasTitleRow && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
        <div className={`flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 ${hasTitleRow ? 'mt-4' : ''}`}>
          {children}
        </div>
      )}
    </div>
  );
}
