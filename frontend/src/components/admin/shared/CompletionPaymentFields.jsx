import { pillCls } from '../../workspace/formStyles';
import { PAYMENT_METHOD_LIST } from '../../../constants/bills';
import { formatMoney } from '../../../utils/money';
import { PAY_MODES, payAmount, resolvePay } from '../../../utils/completionPayment';

const INPUT = 'w-full px-4 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all';
const INPUT_COMPACT = 'w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-slate-400';
const LABEL = 'block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5';
const LABEL_COMPACT = 'block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1';
const NOTE = 'text-[11px] text-slate-500 dark:text-slate-400';

/**
 * The "Paid?" block of a status change to Completed (see
 * utils/completionPayment.js for what each answer does). `value` is the
 * answer (EMPTY_PAY until touched), `suggested` / `balance` come from
 * suggestedPaymentFor; `compact` fits the Update All strip's small controls.
 */
export default function CompletionPaymentFields({ value, onChange, suggested, balance, compact = false, idPrefix = 'completion-pay' }) {
  const r = resolvePay(value, { suggested, balance });
  // Functional update: a pill tap and a keystroke landing in the same tick
  // must not overwrite each other. `onChange` is a state setter.
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const input = compact ? INPUT_COMPACT : INPUT;
  const label = compact ? LABEL_COMPACT : LABEL;
  const owing = balance == null ? null
    : balance > 0 ? `owing ${formatMoney(balance)}`
      : balance < 0 ? `overpaid by ${formatMoney(-balance)}` : 'nothing owing';
  const amountMissing = r.mode === 'now' && !(payAmount(r.amount) > 0);

  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/50 ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className={`${label} mb-0`}>Paid?</p>
        {owing && <p className={`${NOTE} truncate`}>This work order: {owing}</p>}
      </div>
      <div className="flex rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden" role="group" aria-label="Paid?">
        {PAY_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => set({ mode: m.id })}
            aria-pressed={r.mode === m.id}
            className={`flex-1 inline-flex items-center justify-center gap-1 px-1.5 font-bold whitespace-nowrap transition-colors ${
              compact ? 'py-1.5 text-xs' : 'py-2 min-h-11 sm:min-h-0 text-sm'
            } ${r.mode === m.id
              ? 'bg-primary text-white'
              : 'bg-white dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <span className="material-symbols-outlined text-base">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {r.mode === 'now' && (
        <div className={compact ? 'mt-2 space-y-2' : 'mt-3 space-y-3'}>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label htmlFor={`${idPrefix}-amount`} className={label}>Amount received <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span></label>
              <input
                id={`${idPrefix}-amount`}
                type="text"
                inputMode="decimal"
                value={r.amount}
                onChange={(e) => set({ amount: e.target.value })}
                placeholder="0.00"
                aria-invalid={amountMissing}
                className={`${input} font-black ${amountMissing ? 'border-amber-400 dark:border-amber-600' : ''}`}
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-date`} className={label}>Received on</label>
              <input id={`${idPrefix}-date`} type="date" value={r.date} onChange={(e) => set({ date: e.target.value })} className={input} />
            </div>
          </div>
          <div>
            <p id={`${idPrefix}-method`} className={label}>Paid by</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`${idPrefix}-method`}>
              {PAYMENT_METHOD_LIST.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => set({ method: r.method === m.value ? '' : m.value })}
                  aria-pressed={r.method === m.value}
                  className={pillCls(r.method === m.value, { compact: true })}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor={`${idPrefix}-ref`} className={label}>Reference (optional)</label>
            <input
              id={`${idPrefix}-ref`}
              type="text"
              value={r.reference}
              onChange={(e) => set({ reference: e.target.value })}
              maxLength={100}
              placeholder="E-transfer ref, cheque #, last 4"
              className={input}
            />
          </div>
          <p className={NOTE}>
            {suggested != null
              ? `Prefilled with the invoice total incl. tax, ${formatMoney(suggested)}. `
              : 'No charges on this tool yet — type what was received. '}
            The payment is logged on this work order once the status change has gone through.
          </p>
        </div>
      )}
      {r.mode === 'later' && (
        <p className={`${NOTE} mt-2`}>Nothing is logged now. The work order stays owing until the payment is logged from here or from Cash Flow.</p>
      )}
      {r.mode === 'already' && (
        <p className={`${NOTE} mt-2`}>
          Nothing more is logged{balance != null && balance <= 0 ? ' — the payments on this work order already cover it' : ''}.
        </p>
      )}
    </div>
  );
}
