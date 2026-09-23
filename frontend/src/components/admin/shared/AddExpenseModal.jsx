import { useState, useId } from 'react';
import { billsAPI } from '../../../services/api';
import { useToast } from '../../../pages/admin/RepairTracker';
import { apiErrorMessage } from '../../../utils/apiError';
import useEscapeClose from '../../../utils/useEscapeClose';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { INPUT_CLS, AMOUNT_INPUT_CLS, LABEL_CLS, CANCEL_BTN_CLS, SUBMIT_BTN_CLS } from '../../workspace/formStyles';
import { BILL_LINE_KIND_LIST } from '../../../constants/bills';
import { getTodayPacific } from '../../../utils/dateFormat';
import { toolLabel } from '../../../utils/jobAccounting';

const noop = () => {};
// Everything but parts — parts come in on supplier bills logged in Cash Flow.
const EXPENSE_KINDS = BILL_LINE_KIND_LIST.filter((k) => k.value !== 'part');
// Cash Flow category for the bill this creates.
const CATEGORY_FOR = { shipping: 'other', outsourced: 'services', other: 'other' };

/**
 * An additional expense on this work order — courier, outsourced machining,
 * anything the shop paid for the job that isn't a parts bill. It is saved as
 * a Cash Flow bill (one line, linked to the job and optionally a tool), so it
 * counts in Money Out like every other cost and lands on the right tool's
 * profit here.
 */
export default function AddExpenseModal({ job, onSaved, onClose }) {
  const showToast = useToast();
  const uid = useId();
  const tools = job.tools || [];
  const [paidTo, setPaidTo] = useState('');
  const [kind, setKind] = useState('shipping');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [toolId, setToolId] = useState(tools.length === 1 ? tools[0].tool_id : '');
  const [paid, setPaid] = useState(true);
  const [saving, setSaving] = useState(false);
  useEscapeClose(saving ? noop : onClose);
  useBodyScrollLock(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = parseFloat(String(amount).replace(/[$,\s]/g, ''));
    if (!paidTo.trim()) { showToast('error', 'Who was paid?'); return; }
    if (!description.trim()) { showToast('error', 'Say what the expense was for.'); return; }
    if (!(value > 0)) { showToast('error', 'Enter the amount.'); return; }
    const today = getTodayPacific();
    const total = Math.round(value * 100) / 100;
    setSaving(true);
    try {
      const bill = await billsAPI.create({
        supplier_id: null,
        supplier_name: paidTo.trim(),
        category: CATEGORY_FOR[kind] || 'other',
        status: paid ? 'paid' : 'unpaid',
        bill_date: today,
        paid_date: paid ? today : null,
        total,
        currency: 'CAD',
        lines: [{
          description: description.trim(),
          quantity: 1,
          unit_price: total,
          kind,
          repair_id: job.id,
          tool_id: toolId || null,
        }],
        notes: `Logged from work order ${job.request_number}`,
      });
      showToast('success', `${bill.bill_number} logged in Cash Flow`);
      onSaved(bill);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to log the expense.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-start justify-center p-3 sm:p-4 pt-3 sm:pt-10 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-5rem)]"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="min-w-0">
            <h2 id={`${uid}-title`} className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Add an additional expense</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Courier, outsourced work, anything the shop paid for this job that isn’t a parts bill. Saved to Cash Flow.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="p-2 -m-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex-shrink-0 disabled:opacity-50">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form id="expense-form" onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
          <div>
            <label htmlFor={`${uid}-paid-to`} className={LABEL_CLS}>Paid to *</label>
            <input id={`${uid}-paid-to`} type="text" value={paidTo} onChange={(e) => setPaidTo(e.target.value)} maxLength={200} placeholder="Purolator, ABC Machining…" autoFocus className={INPUT_CLS} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-kind`} className={LABEL_CLS}>Kind</label>
              <select id={`${uid}-kind`} value={kind} onChange={(e) => setKind(e.target.value)} className={INPUT_CLS}>
                {EXPENSE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-amount`} className={LABEL_CLS}>Amount ($) *</label>
              <input id={`${uid}-amount`} type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required className={AMOUNT_INPUT_CLS} />
            </div>
          </div>
          <div>
            <label htmlFor={`${uid}-desc`} className={LABEL_CLS}>What for *</label>
            <input id={`${uid}-desc`} type="text" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Courier to the customer" className={INPUT_CLS} />
          </div>
          {tools.length > 1 ? (
            <div>
              <label htmlFor={`${uid}-tool`} className={LABEL_CLS}>Which tool</label>
              <select id={`${uid}-tool`} value={toolId} onChange={(e) => setToolId(e.target.value)} className={INPUT_CLS}>
                <option value="">Whole job (shared)</option>
                {tools.map((t, i) => <option key={t.tool_id} value={t.tool_id}>{i + 1}. {toolLabel(t)}</option>)}
              </select>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">For <span className="font-bold text-slate-900 dark:text-white">{tools[0] ? toolLabel(tools[0]) : job.request_number}</span></p>
          )}
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 min-h-[44px] cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/50 bg-white dark:bg-slate-700" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">Paid already</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">untick if the bill is still owed</span>
          </label>
        </form>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0 flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={CANCEL_BTN_CLS}>Cancel</button>
          <button type="submit" form="expense-form" disabled={saving} className={SUBMIT_BTN_CLS}>
            {saving ? 'Saving...' : 'Log expense'}
          </button>
        </div>
      </div>
    </div>
  );
}
