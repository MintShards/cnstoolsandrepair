/**
 * Shared coverage/staleness thresholds for route management.
 *
 * The server is the authority — `ZoneResponse.coverage_window_days` carries the
 * same number — so prefer that when it's available and treat this as the
 * fallback for screens that don't load a zone.
 */
export const STALE_AFTER_DAYS = 90;

/** Tailwind classes for a coverage bar fill, by how covered a zone is. */
export function coverageBarClass(pct) {
  if (pct === null || pct === undefined) return 'bg-slate-300 dark:bg-slate-600';
  if (pct < 50) return 'bg-red-500';
  if (pct < 80) return 'bg-amber-500';
  return 'bg-green-500';
}

/** Matching text colour for the percentage label. */
export function coverageTextClass(pct) {
  if (pct === null || pct === undefined) return 'text-slate-400 dark:text-slate-500';
  if (pct < 50) return 'text-red-600 dark:text-red-400';
  if (pct < 80) return 'text-amber-600 dark:text-amber-400';
  return 'text-green-600 dark:text-green-400';
}
