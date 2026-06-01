import { useState, useEffect } from 'react';
import { repairsAPI } from '../../services/api';

/**
 * Modal for sending a work order email to the customer.
 * Props:
 *   job            - RepairJobResponse object
 *   template       - workOrderEmailTemplate from business settings
 *   onClose        - called when modal is dismissed
 *   onSuccess      - called with sentTo string when send succeeds
 */
export default function SendWorkOrderEmailModal({ job, template, onClose, onSuccess }) {
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

  // Count tool photos for attachment preview
  const photoCount = (job?.tools || []).reduce((sum, tool) => sum + (tool.photos?.length || 0), 0);

  const ccDisplay = (t.cc || '').trim();
  const bccDisplay = (t.bcc || '').trim();

  const hasEmail = recipientEmail.trim().length > 0;

  async function handleSend() {
    if (!hasEmail) return;
    setSending(true);
    setError(null);
    try {
      const result = await repairsAPI.sendWorkOrderEmail(job.id, {
        recipient_email: recipientEmail.trim() || null,
        subject: subject.trim() || null,
        custom_message: customMessage.trim() || null,
      });
      onSuccess && onSuccess(result.sent_to);
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to send email';
      setError(detail);
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
            disabled={sending || !hasEmail}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                Sending…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'wght' 600" }}>send</span>
                Send Email
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
