import { diagnosisCodesAPI } from '../services/api';

// The diagnosis-code library as the tracker reads it: fetched once and
// shared by every finding editor on the page, with a short TTL so a code
// added in Admin Settings shows up without a reload. `invalidateCodes()`
// after creating one from the tracker itself, so the next picker has it.
let cache = null;
let cachedAt = 0;
const TTL = 2 * 60 * 1000;

export function loadCodes() {
  if (!cache || Date.now() - cachedAt > TTL) {
    cachedAt = Date.now();
    cache = diagnosisCodesAPI.list().catch(() => { cache = null; return []; });
  }
  return cache;
}

export function invalidateCodes() {
  cache = null;
  cachedAt = 0;
}
