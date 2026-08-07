/**
 * Normalize a datetime string from the backend (which emits UTC-naive ISO strings
 * without a 'Z' suffix) so that new Date() parses it as UTC rather than local time.
 */
const normalizeUtcString = (str) => {
  if (typeof str !== 'string') return str;
  // If the string looks like an ISO datetime without any timezone indicator, append Z
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str) && !/[Z+-]\d*$/.test(str)) {
    return str + 'Z';
  }
  return str;
};

/**
 * Format a datetime string as full date + time in Vancouver (Pacific) time.
 * Used for status history entries and other timestamps that include hours/minutes.
 */
export const formatDatePacific = (dateString) => {
  if (!dateString) return '—';
  return new Date(normalizeUtcString(dateString)).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Vancouver',
  });
};

/**
 * Format a datetime string as date only (no time) in Vancouver (Pacific) time.
 * Used for list columns, created_at, date_received, estimated_completion, etc.
 */
export const formatDateShortPacific = (dateString) => {
  if (!dateString) return '—';
  return new Date(normalizeUtcString(dateString)).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Vancouver',
  });
};

/**
 * Format a datetime string as time only in Vancouver (Pacific) time.
 * Used for same-day timestamps like a route stop's completion time.
 */
export const formatTimePacific = (dateString) => {
  if (!dateString) return '—';
  return new Date(normalizeUtcString(dateString)).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Vancouver',
  });
};

const pacificYmd = (date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Vancouver',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(date); // en-CA produces YYYY-MM-DD

/**
 * Pacific calendar days between a backend timestamp and today, or null.
 * Counts calendar days rather than elapsed hours, so a visit logged late
 * yesterday reads "yesterday" and not "today" beside its own date.
 */
export const daysSince = (dateString) => {
  if (!dateString) return null;
  const then = new Date(normalizeUtcString(dateString));
  if (Number.isNaN(then.getTime())) return null;
  const thenDay = Date.parse(`${pacificYmd(then)}T00:00:00Z`);
  const today = Date.parse(`${pacificYmd(new Date())}T00:00:00Z`);
  return Math.round((today - thenDay) / 86400000);
};

const ageLabel = (days) => {
  if (days === null) return null;
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
};

/**
 * Short "how long ago" label — for lists where recency matters more than the
 * exact date (e.g. which prospects are going stale).
 */
export const formatAge = (dateString) => ageLabel(daysSince(dateString));

/**
 * Pacific calendar days between a plain YYYY-MM-DD string (route/follow-up
 * dates, already shop-local) and today. Compared as dates, never through a
 * timezone, so the day can't shift.
 */
export const daysSinceYmd = (ymd) => {
  if (!ymd) return null;
  const then = Date.parse(`${ymd}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  const today = Date.parse(`${getTodayPacific()}T00:00:00Z`);
  return Math.round((today - then) / 86400000);
};

/** formatAge for plain YYYY-MM-DD strings. */
export const formatYmdAge = (ymd) => ageLabel(daysSinceYmd(ymd));

/**
 * Format a plain YYYY-MM-DD string (route/follow-up dates) as "Mar 12, 2026".
 * Built from parts so no UTC parsing can shift the day.
 */
export const formatYmd = (ymd) => {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Get today's date as YYYY-MM-DD in Vancouver (Pacific) time.
 * Used for default date_received on new tools to avoid UTC date mismatch in evening hours.
 */
export const getTodayPacific = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts; // en-CA locale produces YYYY-MM-DD format
};
