/**
 * Normalize a datetime string from the backend (which emits UTC-naive ISO strings
 * without a 'Z' suffix) so that new Date() parses it as UTC rather than local time.
 */
const normalizeUtcString = (str) => {
  if (typeof str !== 'string') return str;
  // If the string looks like an ISO datetime without any timezone indicator, append Z
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str) && !/[Z+\-]\d*$/.test(str)) {
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
