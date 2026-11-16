import { MAX_EXTRA_EMAILS } from '../../../utils/customerEmails';

/**
 * The "Other Emails" rows of a customer form: one row per address, a remove
 * button on each, an add button until the profile holds MAX_EXTRA_EMAILS.
 * The host form keeps the list as typed (blank rows allowed) and cleans it
 * with cleanExtraEmails (utils/customerEmails.js) before saving.
 *
 * Props:
 *   value / onChange  - the list of addresses (strings) and its setter
 *   labelClassName    - the host form's label classes
 *   inputClassName    - the host form's input classes, kept as they are so
 *                       the rows match the Email field above them
 */
export default function ExtraEmailsField({ value, onChange, labelClassName, inputClassName, disabled = false }) {
  const list = value || [];
  const setAt = (index, next) => onChange(list.map((email, i) => (i === index ? next : email)));
  const removeAt = (index) => onChange(list.filter((_, i) => i !== index));

  return (
    <div>
      <label className={labelClassName}>Other Emails</label>
      {list.length > 0 && (
        <div className="space-y-2 mb-2">
          {list.map((email, i) => (
            // Rows have no identity of their own and the inputs are
            // controlled, so the index is a safe key.
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <input
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setAt(i, e.target.value)}
                  placeholder="name@company.com"
                  aria-label={`Other email ${i + 1}`}
                  disabled={disabled}
                  className={inputClassName}
                />
              </div>
              <button
                type="button"
                onClick={() => removeAt(i)}
                disabled={disabled}
                aria-label={`Remove other email ${i + 1}`}
                title="Remove this email"
                className="flex-shrink-0 w-9 h-9 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          ))}
        </div>
      )}
      {list.length < MAX_EXTRA_EMAILS && (
        <button
          type="button"
          onClick={() => onChange([...list, ''])}
          disabled={disabled}
          className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[44px] sm:min-h-0 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          {list.length ? 'Add another email' : 'Add an email'}
        </button>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
        For companies that want their work orders sent to more than one address.
      </p>
    </div>
  );
}
