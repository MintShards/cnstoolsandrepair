import { useState, useEffect, useRef } from 'react';
import { diagnosisCodesAPI } from '../../../services/api';
import { useToast } from '../shared/ToastProvider';
import { apiErrorMessage } from '../../../utils/apiError';
import { INPUT_CLS, LABEL_CLS, CANCEL_BTN_CLS, SUBMIT_BTN_CLS } from '../../workspace/formStyles';
import useEscapeClose from '../../../utils/useEscapeClose';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { GENERAL_TOOL_TYPE, CATEGORIES, GENERAL_CATEGORY, categoryLabel, suggestPrefix, formatCode } from '../../../constants/diagnosisCodes';

const TEXTAREA_CLS = `${INPUT_CLS} resize-y leading-snug`;
// Narrow inputs: INPUT_CLS carries w-full, and an appended w-24 loses to it
// in the cascade (see CLAUDE.md), so the width is swapped in, not added.
const CODE_INPUT_CLS = `${INPUT_CLS.replace('w-full', 'w-24')} font-mono font-bold flex-none`;
const QTY_INPUT_CLS = `${INPUT_CLS.replace('w-full', 'w-20')} text-center flex-none`;
const HINT = 'mt-1 text-xs text-slate-400 dark:text-slate-500';

/**
 * Add or edit one diagnosis code. The prefix follows the tool type until it
 * is edited by hand; a new code's number is the next free one for the prefix
 * (shown as a preview, still editable). List fields are typed one per line.
 */
export default function DiagnosisCodeFormModal({ code, initial = null, toolTypes = [], onSaved, onClose }) {
  const showToast = useToast();
  const editing = Boolean(code);
  useEscapeClose(onClose);
  useBodyScrollLock(true);

  // `initial` seeds a new code from a job's finding (Save as code on the tool card).
  const [category, setCategory] = useState(code?.category || initial?.category || GENERAL_CATEGORY);
  const [toolType, setToolType] = useState(code?.tool_type || initial?.tool_type || '');
  const [prefix, setPrefix] = useState(code?.prefix || '');
  const prefixTouched = useRef(editing);
  const [number, setNumber] = useState(code?.number ?? '');
  const [title, setTitle] = useState(code?.title || initial?.title || '');
  const [causes, setCauses] = useState((code?.likely_causes || []).join('\n'));
  const [checks, setChecks] = useState((code?.technician_checks || []).join('\n'));
  const [solution, setSolution] = useState(code?.solution || initial?.solution || '');
  const seedParts = code?.parts?.length ? code.parts : (initial?.parts || []);
  const [parts, setParts] = useState(seedParts.length
    ? seedParts.map((p) => ({ name: p.name || '', quantity: p.quantity || 1 }))
    : [{ name: '', quantity: 1 }]);
  const [quoteNote, setQuoteNote] = useState(code?.quote_note || initial?.quote_note || '');
  const [active, setActive] = useState(code ? code.active !== false : true);
  const [saving, setSaving] = useState(false);

  // The prefix follows the tool type until the admin types one.
  useEffect(() => {
    if (!prefixTouched.current) setPrefix(suggestPrefix(toolType));
  }, [toolType]);

  // A new code takes the next free number for its prefix; debounced so a
  // prefix being typed doesn't fire a request per keystroke.
  useEffect(() => {
    if (editing) return undefined;
    const clean = prefix.trim();
    if (!clean) return undefined;
    let alive = true;
    const timer = setTimeout(() => {
      diagnosisCodesAPI.next({ prefix: clean })
        .then((d) => { if (alive) setNumber(d.number); })
        .catch(() => {});
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [prefix, editing]);

  const typeOptions = [...new Set([GENERAL_TOOL_TYPE, ...toolTypes.map((t) => String(t).toUpperCase()), code?.tool_type].filter(Boolean))];
  const preview = prefix.trim() && number !== '' ? formatCode(prefix.trim(), number) : '';

  const updatePart = (i, fields) => setParts((prev) => prev.map((p, j) => (j === i ? { ...p, ...fields } : p)));
  const removePart = (i) => setParts((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [{ name: '', quantity: 1 }]));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!toolType.trim()) { showToast('error', 'Pick a tool type (or General).'); return; }
    if (!prefix.trim()) { showToast('error', 'The code needs a prefix.'); return; }
    if (!title.trim()) { showToast('error', 'Give the code its symptom or problem.'); return; }
    const payload = {
      category,
      tool_type: toolType.trim().toUpperCase(),
      prefix: prefix.trim().toUpperCase(),
      title: title.trim(),
      likely_causes: causes,
      technician_checks: checks,
      solution: solution.trim() || null,
      parts: parts.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), quantity: Math.max(1, parseInt(p.quantity, 10) || 1) })),
      quote_note: quoteNote.trim() || null,
      active,
    };
    const n = parseInt(number, 10);
    if (Number.isInteger(n) && n > 0) payload.number = n;
    setSaving(true);
    try {
      const saved = editing
        ? await diagnosisCodesAPI.update(code.id, payload)
        : await diagnosisCodesAPI.create(payload);
      showToast('success', editing ? `${saved.code} updated` : `${saved.code} added`);
      onSaved(saved);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Could not save the code.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 sm:pt-10 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-2xl my-auto sm:my-0">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="min-w-0">
            <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {editing ? `Edit ${code.code}` : initial ? 'Save Finding as a Code' : 'Add Diagnosis Code'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Internal — what the wall chart and the tracker show for this problem.</p>
          </div>
          <button type="button" onClick={onClose} className="min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Section *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT_CLS} aria-label="Section">
                {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
              </select>
              <p className={HINT}>The wall chart section this code sits in.</p>
            </div>
            <div>
              <label className={LABEL_CLS}>Tool type *</label>
              <input
                type="text"
                list="diagnosis-code-tool-types"
                value={toolType}
                onChange={(e) => setToolType(e.target.value)}
                onBlur={() => setToolType((v) => v.trim().toUpperCase())}
                placeholder="e.g. HYDRAULIC JACK, or GENERAL"
                maxLength={100}
                className={INPUT_CLS}
                autoFocus={!editing}
              />
              <datalist id="diagnosis-code-tool-types">
                {typeOptions.map((t) => <option key={t} value={t} />)}
              </datalist>
              <p className={HINT}>General codes apply to every tool.</p>
            </div>
            <div className="md:col-span-2">
              <label className={LABEL_CLS}>Code *</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => { prefixTouched.current = true; setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); }}
                  placeholder="HJ"
                  aria-label="Code prefix"
                  className={`${CODE_INPUT_CLS} uppercase`}
                />
                <span className="text-slate-400 font-bold">-</span>
                <input
                  type="number"
                  min="1"
                  max="9999"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  aria-label="Code number"
                  className={CODE_INPUT_CLS}
                />
                {preview && (
                  <span className="ml-auto flex-shrink-0 whitespace-nowrap inline-flex items-center px-2.5 py-1 rounded-lg border-2 border-slate-900 dark:border-white font-mono font-black text-slate-900 dark:text-white">{preview}</span>
                )}
              </div>
              <p className={HINT}>{editing ? 'Renumbering keeps old findings pointing at this code.' : 'Prefix from the tool type; number is the next free one.'}</p>
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Symptom / Problem *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lifts but will not hold" maxLength={200} className={INPUT_CLS} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Likely causes</label>
              <textarea value={causes} onChange={(e) => setCauses(e.target.value)} rows={4} placeholder={'One per line\nCylinder packing leak\nRelease or bypass valve leakage'} className={TEXTAREA_CLS} />
              <p className={HINT}>Tick boxes on the tracker: the ones that apply become the diagnosis.</p>
            </div>
            <div>
              <label className={LABEL_CLS}>Technician checks</label>
              <textarea value={checks} onChange={(e) => setChecks(e.target.value)} rows={4} placeholder={'One per line\nLoad-hold test\nInspect valve seats and packing'} className={TEXTAREA_CLS} />
              <p className={HINT}>Shown as a reminder while diagnosing.</p>
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Repair</label>
            <textarea value={solution} onChange={(e) => setSolution(e.target.value)} rows={2} placeholder="What needs to be done, e.g. Reseal cylinder; replace release valve; bleed" maxLength={1000} className={TEXTAREA_CLS} />
          </div>

          <div>
            <label className={LABEL_CLS}>Parts needed</label>
            <div className="space-y-2">
              {parts.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => updatePart(i, { name: e.target.value })}
                    placeholder="Part name, e.g. Packing kit"
                    maxLength={200}
                    aria-label={`Part ${i + 1} name`}
                    className={`${INPUT_CLS} flex-1 min-w-0`}
                  />
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={p.quantity}
                    onChange={(e) => updatePart(i, { quantity: e.target.value })}
                    aria-label={`Part ${i + 1} quantity`}
                    className={QTY_INPUT_CLS}
                  />
                  <button type="button" onClick={() => removePart(i)} aria-label={`Remove part ${i + 1}`} className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setParts((prev) => [...prev, { name: '', quantity: 1 }])} className="mt-2 inline-flex items-center gap-1 min-h-[44px] sm:min-h-0 text-sm font-bold text-primary dark:text-blue-400 hover:underline">
              <span className="material-symbols-outlined text-base">add</span>
              Add part
            </button>
            <p className={HINT}>Generic names. On a job they are matched to the model&apos;s parts library, so the part numbers come along.</p>
          </div>

          <div>
            <label className={LABEL_CLS}>Quote note</label>
            <textarea value={quoteNote} onChange={(e) => setQuoteNote(e.target.value)} rows={2} placeholder="What we tell the customer, e.g. Jack loses hydraulic pressure under load; internal leakage requires inspection." maxLength={1000} className={TEXTAREA_CLS} />
            <p className={HINT}>Copied onto the finding, editable per job, with a Copy button for the Zoho quote.</p>
          </div>

          {editing && (
            <label className="flex items-center gap-2 cursor-pointer min-h-[44px] sm:min-h-0">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Active — on the wall chart and the tracker</span>
            </label>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={saving} className={CANCEL_BTN_CLS}>Cancel</button>
            <button type="submit" disabled={saving} className={SUBMIT_BTN_CLS}>{saving ? 'Saving…' : (editing ? 'Save code' : 'Add code')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
