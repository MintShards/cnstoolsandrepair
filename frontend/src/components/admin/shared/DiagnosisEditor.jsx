import { useRef } from 'react';

// Stable id for a finding, so the entry keeps its place across edits.
export const newDiagnosisId = () => (typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

const FIELDS = [
  { key: 'diagnosis', label: 'Diagnosis', placeholder: 'What the technician found' },
  { key: 'solution', label: 'Solution', optional: true, placeholder: 'What needs to be done' },
  { key: 'parts', label: 'Parts', optional: true, placeholder: 'Parts needed, e.g. hammer cage, anvil' },
];
// Slimmer than the form's main inputs: these sit three across, and there can
// be several findings. Still 16px on phones so iOS doesn't zoom on focus.
const BOX = 'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-base sm:text-sm leading-snug focus:outline-none focus:ring-2 focus:ring-primary resize-none';

/**
 * The shop's numbered findings on a tool, three plain boxes each: what the
 * technician found, what needs doing about it, and the parts it needs. All
 * typed by hand; the Parts list further down is entered separately and is
 * not tied to these. One blank entry is always on screen, so the boxes are
 * there to type into.
 */
export default function DiagnosisEditor({ diagnostics, onDiagnosticsChange, showLabel = true }) {
  // The blank entry shown while there are none carries the id the real entry
  // will get on the first keystroke, so React keeps the same box mounted and
  // the cursor stays put. A fresh id is drawn for the next blank.
  const blankId = useRef(newDiagnosisId());
  const blank = { id: blankId.current, diagnosis: '', solution: '', parts: '' };
  const entries = diagnostics.length ? diagnostics : [blank];

  const update = (index, fields) => {
    if (!diagnostics.length) {
      onDiagnosticsChange([{ ...blank, ...fields }]);
      blankId.current = newDiagnosisId();
      return;
    }
    onDiagnosticsChange(diagnostics.map((x, j) => (j === index ? { ...x, ...fields } : x)));
  };
  const remove = (index) => onDiagnosticsChange(diagnostics.filter((_, j) => j !== index));

  return (
    <div className="md:col-span-2">
      {showLabel && (
        <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">
          Diagnosis &amp; Solution <span className="text-xs text-slate-400">(numbered — what was found, what it needs, and the parts for it)</span>
        </label>
      )}
      <div className="space-y-2">
        {entries.map((d, di) => (
          <div key={d.id} className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3">
            {/* Number and title on the left, remove on the right. The remove
                button keeps its 44px tap target on phones but pulls its
                margins in so the row stays one line tall. */}
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-primary/15 text-primary dark:bg-primary/25 dark:text-blue-300 text-[10px] font-black flex items-center justify-center">{di + 1}</span>
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Finding {di + 1}</span>
              {diagnostics.length > 0 && (
                <button
                  type="button"
                  onClick={() => remove(di)}
                  aria-label={`Remove diagnosis ${di + 1}`}
                  title="Remove this finding"
                  className="ml-auto -mr-2 -my-2 sm:my-0 w-7 h-7 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              )}
            </div>
            {/* Two-line boxes: these are sentences, and a single-line input
                clips them on a phone. Three across on a desktop, stacked on
                a phone. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 md:gap-3">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                    {f.label}{f.optional && <span className="text-slate-400"> (optional)</span>}
                  </label>
                  <textarea
                    value={d[f.key] || ''}
                    onChange={(e) => update(di, { [f.key]: e.target.value })}
                    rows={2}
                    placeholder={f.placeholder}
                    aria-label={`${f.label} ${di + 1}`}
                    className={BOX}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onDiagnosticsChange([...diagnostics, { id: newDiagnosisId(), diagnosis: '', solution: '', parts: '' }])}
        className="mt-2 inline-flex items-center gap-1 min-h-[44px] sm:min-h-0 text-sm font-bold text-primary dark:text-blue-400 hover:underline"
      >
        <span className="material-symbols-outlined text-base">add</span>
        Add another diagnosis
      </button>
    </div>
  );
}
