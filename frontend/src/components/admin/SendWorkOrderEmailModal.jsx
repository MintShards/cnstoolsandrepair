import { useEffect, useState } from 'react';
import { customersAPI, repairsAPI } from '../../services/api';
import { buildFullHTML } from './PrintWorkOrder';
import { otherRecipients, recipientsLabel } from '../../utils/customerEmails';

/**
 * Modal for sending a work order email to the customer.
 *
 * One email, several addresses: the work order's own email is in To, and
 * every other address on the customer's profile (its other emails) is
 * listed under it, ticked — a company that wants the work order at accounts
 * payable and the site office gets one message with everyone in To. The
 * profile is read when the modal opens, so the list is always the profile's
 * current one, whatever the work order was opened with.
 *
 * Props:
 *   job            - RepairJobResponse object
 *   template       - workOrderEmailTemplate from business settings
 *   businessInfo, serviceAgreement, history - what the Print button gets:
 *                    the attached PDF is rendered from the same HTML the
 *                    print uses, so the two can never drift
 *   onClose        - called when modal is dismissed
 *   onSuccess      - called with who it went to ("a@x.com and 2 more")
 *                    when the send succeeds
 */
export default function SendWorkOrderEmailModal({ job, template, businessInfo, serviceAgreement, history, onClose, onSuccess }) {
  const t = template || {};

  // Resolve template variables in a string
  function resolveVars(text) {
    if (!text) return text;
    const firstName = job?.first_name || '';
    const lastName = job?.last_name || '';
    const customerName = `${firstName} ${lastName}`.trim() || 'Valued Customer';
    const companyName = job?.company_name || customerName;
    return text
      .replace(/\{work_order_number\}/g, job?.request_number || '')
      .replace(/\{customer_name\}/g, customerName)
      .replace(/\{company_name\}/g, companyName);
  }

  const defaultSubjectRaw = t.defaultSubject || 'Your Work Order {work_order_number} - CNS Tool Repair';
  const defaultSubject = resolveVars(defaultSubjectRaw);

  const [recipientEmail, setRecipientEmail] = useState(job?.email || '');
  const [subject, setSubject] = useState(defaultSubject);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  // The customer's profile, for its other emails. 'loading' holds the Send
  // button back for the moment the lookup takes, so a quick tap can't send
  // to one address when the company asked for several.
  const [customer, setCustomer] = useState(null);
  const [lookup, setLookup] = useState(job?.customer_id ? 'loading' : 'done');
  // The addresses the sender unticked for this one email (all start ticked).
  const [unticked, setUnticked] = useState(() => new Set());
  useEffect(() => {
    if (!job?.customer_id) return undefined;
    let cancelled = false;
    customersAPI.get(job.customer_id)
      .then((profile) => {
        if (cancelled) return;
        setCustomer(profile);
        // A work order with no email of its own starts from the profile's.
        if (!job?.email && profile.email) setRecipientEmail((current) => current || profile.email);
        setLookup('done');
      })
      .catch(() => { if (!cancelled) setLookup('failed'); });
    return () => { cancelled = true; };
  }, [job?.customer_id, job?.email]);

  const others = otherRecipients(customer, recipientEmail);
  const alsoTo = others.filter((email) => !unticked.has(email));
  const toggleOther = (email) => setUnticked((prev) => {
    const next = new Set(prev);
    if (next.has(email)) next.delete(email); else next.add(email);
    return next;
  });

  // Count tool photos for attachment preview
  const photoCount = (job?.tools || []).reduce((sum, tool) => sum + (tool.photos?.length || 0), 0);

  const ccDisplay = (t.cc || '').trim();
  const bccDisplay = (t.bcc || '').trim();

  const hasEmail = recipientEmail.trim().length > 0;

  async function handleSend() {
    if (!hasEmail || lookup === 'loading') return;
    setSending(true);
    setError(null);
    try {
      await repairsAPI.sendWorkOrderEmail(job.id, {
        recipient_email: recipientEmail.trim() || null,
        additional_recipients: alsoTo,
        subject: subject.trim() || null,
        custom_message: customMessage.trim() || null,
        // The print, as the browser would print it: the PDF is made from this.
        work_order_html: buildFullHTML(job, businessInfo, serviceAgreement, { history }),
      });
      onSuccess && onSuccess(recipientsLabel([recipientEmail.trim(), ...alsoTo]));
    } catch (err) {
      // A refused address comes back as a list of problems, not a sentence;
      // only ever put text in the error box.
      const detail = err?.response?.data?.detail;
      const message = typeof detail === 'string' ? detail
        : Array.isArray(detail) ? detail.map((d) => d?.msg).filter(Boolean).join('; ')
        : err?.message;
      setError(message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400" style={{ fontVariationSettings: "'wght' 600" }}>
              mail
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Send Work Order</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{job?.request_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            disabled={sending}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* No-email warning */}
          {!job?.email && !recipientEmail && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
              <span className="material-symbols-outlined text-amber-600 text-sm mt-0.5" style={{ fontVariationSettings: "'wght' 600" }}>warning</span>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                No email address on this job. Enter a recipient email below to continue.
              </p>
            </div>
          )}

          {/* Recipient */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
              To
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              placeholder="customer@example.com"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={sending}
            />
          </div>

          {/* The customer's other emails — one message, everyone in To */}
          {others.length > 0 && (
            <div>
              <p className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                Also send to
              </p>
              <div className="rounded-lg border border-slate-300 dark:border-slate-600 divide-y divide-slate-200 dark:divide-slate-600 bg-white dark:bg-slate-700">
                {others.map((email) => (
                  <label key={email} className="flex items-center gap-3 px-3 py-2 min-h-[44px] sm:min-h-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!unticked.has(email)}
                      onChange={() => toggleOther(email)}
                      disabled={sending}
                      className="w-4 h-4 flex-shrink-0 rounded border-slate-300 dark:border-slate-500 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-900 dark:text-white break-all">{email}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                The other emails on this customer&rsquo;s profile. Untick any that should not get this one.
              </p>
            </div>
          )}
          {lookup === 'failed' && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Could not load this customer&rsquo;s other emails &mdash; this will go to the address above only.
            </p>
          )}

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={sending}
            />
          </div>

          {/* Custom message */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
              Custom Message <span className="normal-case font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              placeholder={resolveVars(t.greeting) || 'Add a personal note for the customer…'}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={sending}
            />
            <p className="text-xs text-slate-400 mt-1">Appears in the email body above the tools list.</p>
          </div>

          {/* CC / BCC */}
          {(ccDisplay || bccDisplay) && (
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
              {ccDisplay && <p><span className="font-semibold">CC:</span> {ccDisplay}</p>}
              {bccDisplay && <p><span className="font-semibold">BCC:</span> {bccDisplay}</p>}
              <p className="text-slate-400">Configured in Repair Tracker email settings.</p>
            </div>
          )}

          {/* Attachments preview */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
            <span className="material-symbols-outlined text-slate-500 text-sm" style={{ fontVariationSettings: "'wght' 600" }}>attach_file</span>
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-semibold">Work order PDF</span>
              {photoCount > 0 && (
                <span className="text-slate-500 dark:text-slate-400"> + {photoCount} tool photo{photoCount !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>

          {/* Sender info */}
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Sending from: <span className="font-medium text-slate-500 dark:text-slate-400">{t.fromName || 'CNS Tool Repair'} &lt;{t.fromEmail || 'service@cnstoolrepair.com'}&gt;</span>
          </p>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
              <span className="material-symbols-outlined text-red-600 text-sm mt-0.5" style={{ fontVariationSettings: "'wght' 600" }}>error</span>
              <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !hasEmail || lookup === 'loading'}
            className="flex items-center gap-2 px-4 sm:px-5 py-2 text-sm font-bold whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                Sending…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'wght' 600" }}>send</span>
                {alsoTo.length > 0 ? `Send to ${alsoTo.length + 1} addresses` : 'Send Email'}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
