import { coverageBarClass, coverageTextClass } from './coverage';

/**
 * How much of a zone has been visited recently. Mirrors the route-progress bar
 * in RoutesTab so the two read the same way.
 *
 * `pct === null` means the zone has no businesses — coverage is undefined, not
 * 0%, so it renders a dash rather than an empty red bar.
 */
export default function CoverageBar({ pct, covered, total, windowDays }) {
  if (pct === null || pct === undefined) {
    return <span className="text-sm text-slate-400 dark:text-slate-600">—</span>;
  }
  return (
    <div
      className="flex items-center gap-2"
      title={`${covered} of ${total} visited in the last ${windowDays} days`}
    >
      <div className="h-1.5 flex-1 max-w-[80px] bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${coverageBarClass(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-bold whitespace-nowrap ${coverageTextClass(pct)}`}>
        {pct}%
      </span>
    </div>
  );
}
