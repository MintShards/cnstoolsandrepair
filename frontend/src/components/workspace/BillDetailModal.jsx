import { useState, useRef } from 'react';
import { billsAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import useEscapeClose from '../../utils/useEscapeClose';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import { INPUT_CLS, LABEL_CLS } from './formStyles';
import { BTN_NEUTRAL, BTN_PRIMARY } from '../sales/ui';
import { BILL_CATEGORIES, PAYMENT_METHODS, PAYMENT_METHOD_LIST, BILL_STATUSES, isBillOverdue, linkedWorkOrders } from '../../constants/bills';
import { formatMoney } from '../../utils/money';
import { getTodayPacific, formatYmd, formatDatePacific, daysSinceYmd } from '../../utils/dateFormat';
import { billAttachmentUrl } from '../../utils/photoUrl';
import { telHref } from '../../utils/links';
import WorkOrderChip from './WorkOrderChip';
import BillStatusPill from './BillStatusPill';
import ConfirmModal from '../sales/ConfirmModal';

const MAX_ATTACHMENTS = 10;
const ACTION = 'w-full sm:w-auto min-h-[44px] sm:min-h-0';
const DANGER_BTN = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold rounded-xl transition-colors text-sm disabled:opacity-50';
const PILL_BASE = 'inline-flex items-center justify-center px-3 py-2 min-h-[44px] sm:min-h-0 rounded-xl border-2 text-xs font-bold uppercase transition-all';
const pillCls = (active) => `${PILL_BASE} ${active
  ? 'border-primary bg-primary/5 text-slate-900 dark:text-white'
  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`;

function Row({ label, children, className = '' }) {
  return (
    <div className={`flex items-start justify-between px-4 py-2.5 gap-3 ${className}`}>
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase pt-0.5 flex-shrink-0">{label}</span>
      <span className="text-right text-slate-900 dark:text-white min-w-0 break-words">{children}</span>
    </div>
  );
}

/**
 * Read view + actions for one bill: mark paid / undo / dispute / void /
 * reopen, attachments in and out, history. Field edits go through
 * BillFormModal via onEdit.
 */
export default function BillDetailModal({ bill, suppliers, onEdit, onChanged, onClose }) {
  const showToast = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [paidDate, setPaidDate] = useState(getTodayPacific());
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [uploading, setUploading] = useState(false);
  // { kind: 'delete' | 'void' | 'attachment', url? }
  const [confirm, setConfirm] = useState(null);
  useEscapeClose(confirm ? () => {} : onClose);
  useBodyScrollLock(true);

  const today = getTodayPacific();
  const overdue = isBillOverdue(bill, today);
  const overdueDays = overdue ? daysSinceYmd(bill.due_date) : 0;
  const supplierRec = bill.supplier_id ? (suppliers || []).find((s) => s.id === bill.supplier_id) : null;
  const jobs = linkedWorkOrders(bill);
  const attachments = bill.attachments || [];
  const history = [...(bill.status_history || [])].reverse();
  const hasTaxBreakdown = bill.subtotal != null || bill.gst != null || bill.pst != null;

  const changeStatus = async (statusValue, extra, successMsg) => {
    setBusy(true);
    try {
      const updated = await billsAPI.setStatus(bill.id, { status: statusValue, ...extra });
      showToast('success', successMsg);
      onChanged(updated);
      return true;
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Could not update the bill.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async () => {
    const ok = await changeStatus('paid', {
      paid_date: paidDate || null,
      payment_method: paymentMethod || null,
      payment_reference: paymentReference.trim() || null,
    }, 'Marked paid.');
    if (ok) setPayOpen(false);
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await billsAPI.remove(bill.id);
      showToast('success', `${bill.bill_number} deleted.`);
      onChanged(null);
      onClose();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to delete the bill.'));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const updated = await billsAPI.uploadAttachment(bill.id, file);
      showToast('success', 'Attachment added.');
      onChanged(updated);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Could not upload that file.'));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = async (url) => {
    setBusy(true);
    try {
      const updated = await billsAPI.deleteAttachment(bill.id, url);
      showToast('success', 'Attachment removed.');
      onChanged(updated);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Could not remove the attachment.'));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const confirmProps = confirm && ({
    delete: {
      message: `Delete ${bill.bill_number} (${bill.supplier_name})? Its attachments are removed too. This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: handleDelete,
    },
    void: {
      message: `Void ${bill.bill_number}? It drops out of every total and count but stays on record under All.`,
      confirmLabel: 'Void',
      confirmClass: 'bg-slate-700 hover:bg-slate-800',
      onConfirm: () => changeStatus('void', {}, 'Bill voided.').then(() => setConfirm(null)),
    },
    attachment: {
      message: 'Remove this attachment? The file is deleted from storage.',
      confirmLabel: 'Remove',
      onConfirm: () => handleRemoveAttachment(confirm.url),
    },
  })[confirm.kind];

  return (
    <>
    {/* Backdrop tap closes (no Cancel button on phones). The confirm dialog
        is a SIBLING: backdrop-blur makes this div the containing block for
        fixed descendants and would anchor the confirm to scrolled content. */}
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-3 sm:p-4 pt-3 sm:pt-10 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget && !confirm) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-5rem)]">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-slate-500 dark:text-slate-400">{bill.bill_number}</span>
              <BillStatusPill status={bill.status} small />
              {overdue && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-black uppercase bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  Overdue{overdueDays > 0 ? ` · ${overdueDays}d` : ''}
                </span>
              )}
            </div>
            <h2 className="mt-1 font-black text-slate-900 dark:text-white tracking-tight leading-snug break-words">{bill.supplier_name}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {BILL_CATEGORIES[bill.category] || bill.category}
              {bill.vendor_invoice_number && ` · ${bill.vendor_invoice_number}`}
            </p>
            {jobs.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {jobs.map((j) => <WorkOrderChip key={j.repair_id} repairId={j.repair_id} requestNumber={j.request_number} />)}
              </div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-black text-slate-900 dark:text-white whitespace-nowrap">{formatMoney(bill.total, bill.currency)}</p>
            <button onClick={onClose} className="mt-1 p-2 -mr-2 -mb-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" aria-label="Close">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 divide-y divide-slate-200 dark:divide-slate-700/60 text-sm">
            <Row label="Bill date">{formatYmd(bill.bill_date)}</Row>
            <Row label="Due">
              {bill.due_date ? (
                <span className={`font-bold ${overdue ? 'text-red-600 dark:text-red-400' : ''}`}>{formatYmd(bill.due_date)}</span>
              ) : <span className="text-slate-400">—</span>}
            </Row>
            {bill.status === 'paid' && (
              <Row label="Paid">
                <span className="font-bold text-green-700 dark:text-green-400">{bill.paid_date ? formatYmd(bill.paid_date) : '—'}</span>
                {(bill.payment_method || bill.payment_reference) && (
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {[PAYMENT_METHODS[bill.payment_method], bill.payment_reference].filter(Boolean).join(' · ')}
                  </span>
                )}
              </Row>
            )}
            {hasTaxBreakdown && (
              <Row label="Breakdown">
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  {[
                    bill.subtotal != null && `Subtotal ${formatMoney(bill.subtotal, bill.currency)}`,
                    bill.gst != null && `GST ${formatMoney(bill.gst, bill.currency)}`,
                    bill.pst != null && `PST ${formatMoney(bill.pst, bill.currency)}`,
                  ].filter(Boolean).join(' · ')}
                </span>
              </Row>
            )}
            {bill.zoho_bill_number && <Row label="Zoho bill #">{bill.zoho_bill_number}</Row>}
            {supplierRec && (supplierRec.phone || supplierRec.email) && (
              <Row label="Contact">
                {supplierRec.phone && <a href={telHref(supplierRec.phone)} className="block font-bold text-primary dark:text-blue-400">{supplierRec.phone}</a>}
                {supplierRec.email && <a href={`mailto:${supplierRec.email}`} className="block text-xs text-primary dark:text-blue-400 break-all">{supplierRec.email}</a>}
              </Row>
            )}
            <Row label="Logged">
              <span className="text-slate-600 dark:text-slate-300">{formatDatePacific(bill.created_at)}</span>
              {bill.created_by?.name && <span className="block text-xs text-slate-400">by {bill.created_by.name}</span>}
            </Row>
          </div>

          {bill.lines?.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Lines</h3>
              <ul className="rounded-xl border border-slate-200 dark:border-slate-700/60 divide-y divide-slate-200 dark:divide-slate-700/60 text-sm">
                {bill.lines.map((ln, i) => (
                  <li key={i} className="px-3.5 py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white break-words">{ln.description}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                        {ln.part_number && <span>{ln.part_number}</span>}
                        <span>{ln.quantity}{ln.unit_price != null && ` × ${formatMoney(ln.unit_price, bill.currency)}`}</span>
                        {ln.repair_id && ln.request_number && <WorkOrderChip repairId={ln.repair_id} requestNumber={ln.request_number} />}
                      </p>
                    </div>
                    {ln.line_total != null && <span className="font-bold whitespace-nowrap text-slate-900 dark:text-white">{formatMoney(ln.line_total, bill.currency)}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Attachments ({attachments.length})</h3>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { handleUpload(e.target.files?.[0]); e.target.value = ''; }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || attachments.length >= MAX_ATTACHMENTS} className="inline-flex items-center gap-1 text-xs font-bold text-primary dark:text-blue-400 hover:underline min-h-[44px] sm:min-h-0 disabled:opacity-50">
                <span className={`material-symbols-outlined text-sm ${uploading ? 'animate-spin' : ''}`}>{uploading ? 'progress_activity' : 'add_a_photo'}</span>
                {uploading ? 'Uploading…' : 'Add photo / PDF'}
              </button>
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">No photo or PDF of this bill yet.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2">
                {attachments.map((a) => {
                  const href = billAttachmentUrl(bill.id, a.url);
                  return (
                    <li key={a.url} className="relative group">
                      <a href={href} target="_blank" rel="noopener noreferrer" title={a.filename || a.kind} className="block rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                        {a.kind === 'pdf' ? (
                          <span className="h-24 flex flex-col items-center justify-center gap-1 px-2 text-slate-600 dark:text-slate-300">
                            <span className="material-symbols-outlined text-3xl text-red-500">picture_as_pdf</span>
                            <span className="text-[10px] font-bold truncate max-w-full">{a.filename || 'PDF'}</span>
                          </span>
                        ) : (
                          <img src={href} alt={a.filename || 'Bill photo'} loading="lazy" className="w-full h-24 object-cover" />
                        )}
                      </a>
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: 'attachment', url: a.url })}
                        disabled={busy}
                        aria-label="Remove attachment"
                        className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-500 hover:text-red-500 flex items-center justify-center shadow"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {bill.notes && (
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">{bill.notes}</p>
          )}

          {history.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">History</h3>
              <ol className="space-y-1">
                {history.map((h, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${(BILL_STATUSES[h.status] || BILL_STATUSES.unpaid).dot}`} />
                    <span className="min-w-0">
                      <span className="font-bold text-slate-900 dark:text-white">{(BILL_STATUSES[h.status] || BILL_STATUSES.unpaid).label}</span>
                      {' · '}{formatDatePacific(h.timestamp)}
                      {h.by?.name && ` · ${h.by.name}`}
                      {h.notes && <span className="block text-slate-500 dark:text-slate-400">{h.notes}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {payOpen && (
            <div className="rounded-xl border border-green-300 dark:border-green-800/40 bg-green-50/60 dark:bg-green-900/10 p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Paid on</label>
                  <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Reference</label>
                  <input type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} maxLength={100} placeholder="Last 4, e-transfer ref, cheque #" className={INPUT_CLS} autoFocus />
                </div>
              </div>
              <div>
                <label className={LABEL_CLS}>Paid by</label>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHOD_LIST.map((m) => (
                    <button key={m.value} type="button" onClick={() => setPaymentMethod(paymentMethod === m.value ? '' : m.value)} className={pillCls(paymentMethod === m.value)}>{m.label}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPayOpen(false)} disabled={busy} className={`${BTN_NEUTRAL} flex-1 min-h-[44px] sm:min-h-0`}>Cancel</button>
                <button type="button" onClick={markPaid} disabled={busy} className={`${BTN_PRIMARY} flex-1 min-h-[44px] sm:min-h-0 disabled:opacity-50`}>
                  <span className="material-symbols-outlined text-base">check</span>
                  Confirm paid {formatMoney(bill.total, bill.currency)}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0 flex flex-col sm:flex-row sm:flex-wrap gap-2">
          {(bill.status === 'unpaid' || bill.status === 'disputed') && !payOpen && (
            <button type="button" onClick={() => setPayOpen(true)} disabled={busy} className={`${BTN_PRIMARY} ${ACTION} disabled:opacity-50`}>
              <span className="material-symbols-outlined text-base">price_check</span>
              Mark paid
            </button>
          )}
          {bill.status === 'paid' && (
            <button type="button" onClick={() => changeStatus('unpaid', {}, 'Payment undone — back to unpaid.')} disabled={busy} className={`${BTN_NEUTRAL} ${ACTION}`}>
              <span className="material-symbols-outlined text-base">undo</span>
              Undo payment
            </button>
          )}
          {bill.status === 'void' && (
            <button type="button" onClick={() => changeStatus('unpaid', {}, 'Bill reopened.')} disabled={busy} className={`${BTN_PRIMARY} ${ACTION} disabled:opacity-50`}>
              <span className="material-symbols-outlined text-base">restart_alt</span>
              Reopen
            </button>
          )}
          {bill.status === 'unpaid' && (
            <button type="button" onClick={() => changeStatus('disputed', {}, 'Marked disputed.')} disabled={busy} className={`${BTN_NEUTRAL} ${ACTION}`}>
              <span className="material-symbols-outlined text-base">report</span>
              Dispute
            </button>
          )}
          {bill.status === 'disputed' && (
            <button type="button" onClick={() => changeStatus('unpaid', {}, 'Back to unpaid.')} disabled={busy} className={`${BTN_NEUTRAL} ${ACTION}`}>
              <span className="material-symbols-outlined text-base">undo</span>
              Back to unpaid
            </button>
          )}
          {(bill.status === 'unpaid' || bill.status === 'disputed') && (
            <button type="button" onClick={() => setConfirm({ kind: 'void' })} disabled={busy} className={`${BTN_NEUTRAL} ${ACTION}`}>
              <span className="material-symbols-outlined text-base">block</span>
              Void
            </button>
          )}
          <span className="hidden sm:block flex-1" />
          <button type="button" onClick={() => onEdit(bill)} disabled={busy} className={`${BTN_NEUTRAL} ${ACTION}`}>
            <span className="material-symbols-outlined text-base">edit</span>
            Edit
          </button>
          <button type="button" onClick={() => setConfirm({ kind: 'delete' })} disabled={busy} className={`${DANGER_BTN} ${ACTION}`}>
            <span className="material-symbols-outlined text-base">delete</span>
            Delete
          </button>
        </div>
      </div>
    </div>
    {confirm && (
      <ConfirmModal
        message={confirmProps.message}
        confirmLabel={confirmProps.confirmLabel}
        confirmClass={confirmProps.confirmClass}
        onConfirm={confirmProps.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    )}
    </>
  );
}
