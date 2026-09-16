// Money formatting for the Bills section. en-CA renders CAD as "$1,234.50"
// and USD as "US$80.00", so the two never read the same when they sit
// side by side. Amounts stay plain numbers everywhere else.

export function formatMoney(amount, currency = 'CAD') {
  if (amount === null || amount === undefined || amount === '' || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * A per-currency totals map from the API ({ CAD: 1234.5, USD: 80 }) as
 * ordered [{ currency, amount }] pairs, CAD first — the tiles show the CAD
 * figure large and any USD line small underneath, never a mixed sum.
 */
export function totalsByCurrency(totals) {
  const entries = Object.entries(totals || {}).filter(([, v]) => Number(v) !== 0);
  entries.sort(([a], [b]) => (a === 'CAD' ? -1 : b === 'CAD' ? 1 : a.localeCompare(b)));
  return entries.map(([currency, amount]) => ({ currency, amount }));
}
