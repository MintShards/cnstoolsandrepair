import { useState, useId } from 'react';
import { repairsAPI } from '../../../services/api';
import { useToast } from '../../../pages/admin/RepairTracker';
import { apiErrorMessage } from '../../../utils/apiError';
import useEscapeClose from '../../../utils/useEscapeClose';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { INPUT_CLS, AMOUNT_INPUT_CLS, LABEL_CLS, CANCEL_BTN_CLS, SUBMIT_BTN_CLS } from '../../workspace/formStyles';
import { toolLabel } from '../../../utils/jobAccounting';

const noop = () => {};

/**
 * Add one extra charge (shop supplies, freight billed on, a fee…) to a tool
 * on this work order without opening the whole tool form. Saves through the
 * tool update route, so the charge lands on that tool's revenue and shows in
 * its activity diff like any other edit.
 */
export default function AddExtraChargeModal({ job, defaultToolId, onSaved, onClose }) {
  const showToast = useToast();
  const uid = useId();
  const tools = job.tools || [];
  const [toolId, setToolId] = useState(defaultToolId || tools[0]?.tool_id || '');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  useEscapeClose(saving ? noop : onClose);
  useBodyScrollLock(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const tool = tools.find((t) => t.tool_id === toolId);
    const value = parseFloat(String(amount).replace(/[$,\s]/g, ''));
    if (!tool) { showToast('error', 'Pick which tool the charge is for.'); return; }
    if (!description.trim()) { showToast('error', 'Say what the charge is for.'); return; }
    if (!(value >= 0)) { showToast('error', 'Enter the amount.'); return; }
    setSaving(true);
    try {
      const updated = await repairsAPI.updateTool(job.id, tool.tool_id, {
        extra_charges: [
          ...(tool.extra_charges || []).map((c) => ({ description: c.description, amount: c.amount })),
          { description: description.trim(), amount: Math.round(value * 100) / 100 },
        ],
      });
      showToast('success', `Charge added to ${toolLabel(tool)}`);
      onSaved(updated);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to add the charge.'));
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
            <h2 id={`${uid}-title`} className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Add an extra charge</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Shop supplies, freight billed on, a fee — anything the customer pays beyond labour and parts. Before tax.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="p-2 -m-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex-shrink-0 disabled:opacity-50">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form id="extra-charge-form" onSubmit={handleSubmit} className="p-5 flex flex-col gap-5 overflow-y-auto flex-1 min-h-0">
          {tools.length > 1 ? (
            <div>
              <label htmlFor={`${uid}-tool`} className={LABEL_CLS}>Which tool *</label>
              <select id={`${uid}-tool`} value={toolId} onChange={(e) => setToolId(e.target.value)} className={INPUT_CLS}>
                {tools.map((t, i) => <option key={t.tool_id} value={t.tool_id}>{i + 1}. {toolLabel(t)}</option>)}
              </select>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">For <span className="font-bold text-slate-900 dark:text-white">{tools[0] ? toolLabel(tools[0]) : 'this job'}</span></p>
          )}
          <div>
            <label htmlFor={`${uid}-desc`} className={LABEL_CLS}>What for *</label>
            <input id={`${uid}-desc`} type="text" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="Shop supplies" autoFocus className={INPUT_CLS} />
          </div>
          <div>
            <label htmlFor={`${uid}-amount`} className={LABEL_CLS}>Amount ($, before tax) *</label>
            <input id={`${uid}-amount`} type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required className={AMOUNT_INPUT_CLS} />
          </div>
        </form>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0 flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={CANCEL_BTN_CLS}>Cancel</button>
          <button type="submit" form="extra-charge-form" disabled={saving} className={SUBMIT_BTN_CLS}>
            {saving ? 'Saving...' : 'Add charge'}
          </button>
        </div>
      </div>
    </div>
  );
}
