// A customer profile's email addresses. `email` is the main one — the
// address a customer is found by and the one copied onto their work orders.
// `additional_emails` are the other people at the company who also want the
// work order (accounts payable, the site office…): edited on the profile
// (ExtraEmailsField), listed ticked in the Send Work Order window.

export const MAX_EXTRA_EMAILS = 10; // MAX_ADDITIONAL_EMAILS in backend/app/models/customer.py

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tidy = (email) => (email || '').trim().toLowerCase();

/**
 * The other emails as they should be saved: trimmed, lower-cased,
 * de-duplicated, no blank rows and never the main email. `invalid` is the
 * first entry that is not an email address (null when all are fine), so the
 * form can name it instead of waiting for the server to refuse the save.
 */
export function cleanExtraEmails(list, mainEmail) {
  const main = tidy(mainEmail);
  const emails = [];
  let invalid = null;
  for (const raw of list || []) {
    const email = tidy(raw);
    if (!email || email === main || emails.includes(email)) continue;
    if (!invalid && !EMAIL_RE.test(email)) invalid = email;
    emails.push(email);
  }
  return { emails, invalid };
}

/** Every address on a profile, the main one first, each once. */
export function profileEmails(customer) {
  const out = [];
  for (const raw of [customer?.email, ...(customer?.additional_emails || [])]) {
    const email = tidy(raw);
    if (email && !out.includes(email)) out.push(email);
  }
  return out;
}

/**
 * The profile's addresses a work order email can also go to: all of them
 * except the one already typed in To. A work order keeps the email it was
 * opened with, so when the profile's main email has changed since, the new
 * one is offered here beside the others.
 */
export function otherRecipients(customer, toEmail) {
  const to = tidy(toEmail);
  return profileEmails(customer).filter((email) => email !== to);
}

/** "a@x.com", "a@x.com and b@x.com", "a@x.com and 2 more" — for a toast. */
export function recipientsLabel(emails) {
  const list = (emails || []).filter(Boolean);
  if (list.length <= 1) return list[0] || '';
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list[0]} and ${list.length - 1} more`;
}
