import { useState, useId } from 'react';
import { paymentsAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import useEscapeClose from '../../utils/useEscapeClose';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import { INPUT_CLS, AMOUNT_INPUT_CLS, LABEL_CLS, CANCEL_BTN_CLS, SUBMIT_BTN_CLS, pillCls } from './formStyles';
import { PAYMENT_METHOD_LIST, CURRENCIES } from '../../constants/bills';
import { round2 } from '../../utils/money';
import { getTodayPacific, formatDatePacific } from '../../utils/dateFormat';
import WorkOrderPicker from './WorkOrderPicker';
import ConfirmModal from '../sales/ConfirmModal';

const noop = () => {};

const num = (s) => {
  const v = parseFloat(String(s).replace(/[$,\s]/g, ''));
  return Number.isNaN(v) ? null : v;
};

/**
 * Log or edit a customer payment (money in). Picking a work order prefills
 * the customer; the Zoho invoice number ties it back to the books.
 * `defaults` prefills create mode — the work order dialog passes its job.
 */
export default function PaymentFormModal({ payment, defaults, onSaved, onDeleted, onClose }) {
  const showToast = useToast();
  const uid = useId();
  const fid = (name) => `${uid}-${name}`;
  const editing = Boolean(payment);
  const seed = !editing ? (defaults || {}) : {};

  const [customerName, setCustomerName] = useState(payment?.customer_name || seed.customer_name || '');
  const [workOrder, setWorkOrder] = useState(
    payment?.repair_id
      ? { repair_id: payment.repair_id, request_number: payment.request_number }
      : (seed.workOrder || null),
  );
  const [zohoInvoiceNumber, setZohoInvoiceNumber] = useState(payment?.zoho_invoice_number || seed.zoho_invoice_number || '');
  const [amount, setAmount] = useState(payment?.amount != null ? String(payment.amount) : '');
  const [currency, setCurrency] = useState(payment?.currency || 'CAD');
  const [receivedDate, setReceivedDate] = useState(payment?.received_date || getTodayPacific());
  const [paymentMethod, setPaymentMethod] = useState(payment?.payment_method || '');
  const [paymentReference, setPaymentReference] = useState(payment?.payment_reference || '');
  const [notes, setNotes] = useState(payment?.notes || '');
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // The confirm dialog owns Escape while it is up; nothing closes mid-save.
  useEscapeClose(confirmingDelete || saving ? noop : onClose);
  useBodyScrollLock(true);

  const handleWorkOrder = (wo) => {
    setWorkOrder(wo);
    if (wo?.customer && !customerName.trim()) setCustomerName(wo.customer);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const a = num(amount);
    if (!(a > 0)) { showToast('error', 'Enter the amount received.'); return; }
    const payload = {
      customer_name: customerName.trim(),
      repair_id: workOrder?.repair_id || null,
      zoho_invoice_number: zohoInvoiceNumber.trim() || null,
      amount: round2(a),
      currency,
      received_date: receivedDate || null,
      payment_method: paymentMethod || null,
      payment_reference: paymentReference.trim() || null,
      notes: notes.trim() || null,
    };
    setSaving(true);
    try {
      const saved = editing
        ? await paymentsAPI.update(payment.id, payload)
        : await paymentsAPI.create(payload);
      showToast('success', editing ? 'Payment updated.' : `${saved.payment_number} logged.`);
      onSaved(saved);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to save the payment.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await paymentsAPI.remove(payment.id);
      showToast('success', `${payment.payment_number} deleted.`);
      onDeleted();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to delete the payment.'));
    } finally {
      setSaving(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-3 sm:p-4 pt-3 sm:pt-10 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={fid('title')}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-5rem)]"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="min-w-0">
            <h2 id={fid('title')} className="font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {editing ? `Edit ${payment.payment_number}` : 'Log a payment'}
            </h2>
            {editing && payment.created_at && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Logged {formatDatePacific(payment.created_at)}{payment.created_by?.name && ` by ${payment.created_by.name}`}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-2 -m-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex-shrink-0 disabled:opacity-50" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form id="payment-form" onSubmit={handleSubmit} className="p-5 flex flex-col gap-5 overflow-y-auto flex-1 min-h-0">
          <div>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <label htmlFor={fid('amount')} className={`${LABEL_CLS} mb-0`}>Amount received *</label>
              {CURRENCIES.length > 1 && (
                <div className="flex gap-1" role="group" aria-label="Currency">
                  {CURRENCIES.map((c) => (
                    <button key={c} type="button" onClick={() => setCurrency(c)} aria-pressed={currency === c} className={pillCls(currency === c, { compact: true })}>{c}</button>
                  ))}
                </div>
              )}
            </div>
            <input id={fid('amount')} type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required autoFocus={!editing} className={AMOUNT_INPUT_CLS} />
          </div>

          <WorkOrderPicker value={workOrder} onChange={handleWorkOrder} label="Work order (optional)" />

          <div>
            <label htmlFor={fid('customer')} className={LABEL_CLS}>Customer *</label>
            <input id={fid('customer')} type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={200} required placeholder="Company or name" className={INPUT_CLS} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={fid('zoho')} className={LABEL_CLS}>Zoho invoice #</label>
              <input id={fid('zoho')} type="text" value={zohoInvoiceNumber} onChange={(e) => setZohoInvoiceNumber(e.target.value)} maxLength={100} placeholder="INV-000123" className={INPUT_CLS} />
            </div>
            <div>
              <label htmlFor={fid('received')} className={LABEL_CLS}>Received on</label>
              <input id={fid('received')} type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={INPUT_CLS} />
            </div>
          </div>

          <div>
            <p id={fid('method')} className={LABEL_CLS}>Paid by</p>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby={fid('method')}>
              {PAYMENT_METHOD_LIST.map((m) => (
                <button key={m.value} type="button" onClick={() => setPaymentMethod(paymentMethod === m.value ? '' : m.value)} aria-pressed={paymentMethod === m.value} className={pillCls(paymentMethod === m.value)}>{m.label}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={fid('reference')} className={LABEL_CLS}>Reference</label>
              <input id={fid('reference')} type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} maxLength={100} placeholder="E-transfer ref, cheque #, last 4" className={INPUT_CLS} />
            </div>
            <div>
              <label htmlFor={fid('notes')} className={LABEL_CLS}>Notes</label>
              <textarea id={fid('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} rows={2} placeholder="Partial payment, deposit…" className={`${INPUT_CLS} resize-none`} />
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0 flex gap-2">
          {editing && (
            <button type="button" onClick={() => setConfirmingDelete(true)} disabled={saving} title="Delete this payment" aria-label="Delete this payment" className="px-4 py-2.5 min-h-[44px] sm:min-h-0 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold rounded-xl transition-colors text-sm disabled:opacity-50">
              <span className="material-symbols-outlined text-base align-middle">delete</span>
            </button>
          )}
          <button type="button" onClick={onClose} disabled={saving} className={CANCEL_BTN_CLS}>Cancel</button>
          <button type="submit" form="payment-form" disabled={saving || !customerName.trim()} className={SUBMIT_BTN_CLS}>
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Log payment'}
          </button>
        </div>
      </div>
    </div>
    {confirmingDelete && (
      <ConfirmModal
        message={`Delete ${payment.payment_number} (${payment.customer_name})? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    )}
    </>
  );
}
