/** Progressive NANP formatting as the user types: 555 → 555-012 → 555-012-3456 */
export function formatPhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '').slice(0, 10);
  if (digits.length >= 7) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length >= 4) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return digits;
}

/**
 * Blank is allowed (phone is optional), but a partial number is not — the API
 * requires a full ###-###-#### and rejects anything shorter.
 */
export function isPhoneSubmittable(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 0 || digits.length === 10;
}
