/**
 * Convert an axios error into a plain string safe to render.
 *
 * FastAPI returns validation (422) `detail` as an array of {loc, msg, type}
 * objects. Passing that array straight into JSX throws "Objects are not valid
 * as a React child" and unmounts the tree, so every error path must go through
 * here rather than reading `err.response.data.detail` directly.
 */

const LOC_PREFIXES = new Set(['body', 'query', 'path', 'header', 'cookie']);

function fieldLabel(loc) {
  if (!Array.isArray(loc)) return '';
  const parts = loc.filter((p) => typeof p === 'string' && !LOC_PREFIXES.has(p));
  if (parts.length === 0) return '';
  return parts[parts.length - 1].replace(/_/g, ' ');
}

function oneMessage(entry) {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return '';
  const msg = typeof entry.msg === 'string' ? entry.msg.replace(/^Value error,\s*/, '') : '';
  if (!msg) return '';
  const label = fieldLabel(entry.loc);
  return label ? `${label}: ${msg}` : msg;
}

export function apiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const detail = err?.response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const messages = detail.map(oneMessage).filter(Boolean);
    if (messages.length) return messages.join(' · ');
  }

  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const single = oneMessage(detail);
    if (single) return single;
  }

  return fallback;
}

export default apiErrorMessage;
