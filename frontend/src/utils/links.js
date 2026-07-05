// Builds an RFC 3966 tel: href from a phone string that may contain
// formatting characters like "(778) 488-0777". 10-digit North American
// numbers get the +1 country code so dialing works from any device.
export function telHref(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return 'tel:';
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `tel:+${digits}`;
  return `tel:${digits}`;
}

// Social URLs saved as bare platform homepages (e.g. https://www.whatsapp.com)
// are placeholders, not real profiles — treat them as unset so the footer
// never renders a dead link. Real profile URLs always carry a path
// (facebook.com/profile.php?id=…, wa.me/1778…, linkedin.com/company/…).
export function isRealSocialUrl(url) {
  try {
    const { pathname } = new URL(url);
    return pathname !== '' && pathname !== '/';
  } catch {
    return false;
  }
}
