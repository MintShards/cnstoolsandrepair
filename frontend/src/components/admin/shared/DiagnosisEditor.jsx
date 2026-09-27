import { useEffect, useMemo, useRef, useState } from 'react';
import { orderForTool, codeMatches, parseCodeQuery, codeQueryMatches } from '../../../constants/diagnosisCodes';
import { matchCodeParts, partRowFromMatch, isPartListed } from '../../../utils/suggestedParts';
import { loadCodes } from '../../../utils/diagnosisCodesCache';

// Stable id for a finding, so the entry keeps its place across edits.
export const newDiagnosisId = () => (typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

const emptyFinding = () => ({ diagnosis: '', solution: '', parts: '', code: '', customer_explanation: '' });

const FIELDS = [
  { key: 'diagnosis', label: 'Diagnosis', placeholder: 'What the technician found' },
  { key: 'solution', label: 'Solution', optional: true, placeholder: 'What needs to be done' },
  { key: 'parts', label: 'Parts', optional: true, placeholder: 'Parts needed, e.g. hammer cage, anvil' },
];
// Slimmer than the form's main inputs: these sit three across, and there can
// be several findings. Still 16px on phones so iOS doesn't zoom on focus.
const BOX = 'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-base sm:text-sm leading-snug focus:outline-none focus:ring-2 focus:ring-primary resize-none';
const SMALL_LABEL = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';
const SUB = 'text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const CHIP = 'inline-flex items-center flex-shrink-0 px-1.5 py-0.5 rounded-md border-2 border-slate-900 dark:border-slate-100 font-mono font-black text-xs text-slate-900 dark:text-white';
const LINK_BTN = 'inline-flex items-center gap-1 min-h-[44px] sm:min-h-0 text-sm font-bold text-primary dark:text-blue-400 hover:underline';
const NEUTRAL_BTN = 'inline-flex items-center justify-center px-3 py-1.5 min-h-[44px] sm:min-h-0 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all';
const MAX_RESULTS = 8;
// A box grows with its text (a code's repair line can run long), within reason.
const rowsFor = (text) => Math.min(8, Math.max(2, Math.ceil(String(text || '').length / 30)));
// The parts a code needs, as a finding's parts note: "Packing kit, Release valve ×2".
const partsNote = (c) => (c.parts || []).map((p) => (p.quantity > 1 ? `${p.name} ×${p.quantity}` : p.name)).join(', ');

// A code-shaped query ("hj3", "HJ-03", "hj") matches by prefix and number;
// anything else is a word search over the chart text.
function searchCodes(ordered, query) {
  const q = query.trim();
  if (!q) return { list: ordered.slice(0, MAX_RESULTS), total: ordered.length };
  const parsed = parseCodeQuery(q);
  const byCode = parsed ? ordered.filter((c) => codeQueryMatches(c, parsed)) : [];
  const list = byCode.length ? byCode : ordered.filter((c) => codeMatches(c, q));
  return { list: list.slice(0, MAX_RESULTS), total: list.length };
}
function exactCode(ordered, query) {
  const parsed = parseCodeQuery(query);
  return parsed && parsed.number != null ? ordered.find((c) => codeQueryMatches(c, parsed)) : null;
}

/** The search box and dropdown over the code library. Enter picks the exact code, else the first result. */
function CodeSearch({ ordered, onPick, placeholder, ariaLabel, autoFocus = false, onCancel }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const results = useMemo(() => searchCodes(ordered, query), [ordered, query]);
  const choose = (c) => { setQuery(''); setOpen(false); onPick(c); };
  const onKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); onCancel?.(); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const target = exactCode(ordered, query) || results.list[0];
    if (target) choose(target);
  };
  return (
    <div className="relative flex-1 min-w-0">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
        disabled={!ordered.length}
        placeholder={ordered.length ? placeholder : 'No diagnosis codes yet (Admin Settings → Diagnosis Codes)'}
        aria-label={ariaLabel}
        autoComplete="off"
        autoCapitalize="characters"
        autoFocus={autoFocus}
        className={BOX}
      />
      {open && results.list.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl">
          {results.list.map((c) => (
            <button
              type="button"
              key={c.id}
              onMouseDown={(e) => { e.preventDefault(); choose(c); }}
              className="w-full text-left px-3 py-2 min-h-[44px] sm:min-h-0 flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 border-b last:border-b-0 border-slate-100 dark:border-slate-700/60 transition-colors"
            >
              <span className={CHIP}>{c.code}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{c.title}</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{c.tool_type}{c.parts?.length ? ` · ${c.parts.length} part${c.parts.length === 1 ? '' : 's'}` : ''}</span>
              </span>
            </button>
          ))}
          {results.total > results.list.length && (
            <p className="px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40">{results.total - results.list.length} more — keep typing</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The shop's numbered findings on a tool: what the technician found, what
 * needs doing, the parts it needs, and — when there is one — what we tell
 * the customer (the quote wording, internal). All typed by hand, or filled
 * from a diagnosis code off the wall: the "Use code" box above the findings
 * adds a finding from the code and, through `onApplyCode`, the code's parts
 * to the tool's Parts list, matched against `libraryParts`. A hand-typed
 * finding can be linked to a code afterwards ("Link code": keeps the text,
 * stamps the code, fills the blank boxes). One blank entry is always on
 * screen, so the boxes are there to type into.
 *
 * onApplyCode(nextDiagnostics, partRows): one call carrying both, so a host
 * that keeps them in one form object updates it once (two successive
 * updates from the same render would lose the first). Each row carries
 * `_finding_id` — the finding it came from — so a host can drop queued rows
 * when that finding is removed; strip it before saving.
 */
export default function DiagnosisEditor({
  diagnostics,
  onDiagnosticsChange,
  showLabel = true,
  toolType = '',
  libraryParts = [],
  libraryLoading = false,
  existingParts = [],
  onApplyCode,
}) {
  // The blank entry shown while there are none carries the id the real entry
  // will get on the first keystroke, so React keeps the same box mounted and
  // the cursor stays put. A fresh id is drawn for the next blank.
  const blankId = useRef(newDiagnosisId());
  const blank = { id: blankId.current, ...emptyFinding() };
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

  // The customer-wording box is shown when it has content or came from a
  // code; a hand-typed finding gets a link instead, so phones stay short.
  const [customerOpen, setCustomerOpen] = useState({});

  // ── The code library ────────────────────────────────
  const [codes, setCodes] = useState([]);
  useEffect(() => {
    let alive = true;
    loadCodes().then((c) => { if (alive) setCodes(Array.isArray(c) ? c : []); });
    return () => { alive = false; };
  }, []);
  const ordered = useMemo(() => orderForTool(codes.filter((c) => c.active !== false), toolType), [codes, toolType]);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  // ── Use a code: a new finding from the wall ─────────
  const [picked, setPicked] = useState(null);   // the code being applied
  const [ticked, setTicked] = useState([]);     // likely causes the tech confirmed
  const [addParts, setAddParts] = useState(true);
  const scrollToId = useRef(null);
  const matches = useMemo(() => (picked ? matchCodeParts(picked.parts, libraryParts) : []), [picked, libraryParts]);
  const alreadyAt = picked ? diagnostics.findIndex((d) => d.code === picked.code) : -1;

  const pick = (c) => { setPicked(c); setTicked([]); setAddParts(true); };

  const apply = () => {
    const causes = (picked.likely_causes || []).filter((_, i) => ticked.includes(i));
    const finding = {
      id: newDiagnosisId(),
      code: picked.code,
      diagnosis: causes.length ? `${picked.title} — ${causes.join('; ')}` : picked.title,
      solution: picked.solution || '',
      parts: partsNote(picked),
      customer_explanation: picked.quote_note || '',
    };
    const next = [...diagnostics, finding];
    const fresh = addParts ? matches.filter((m) => !isPartListed(existingParts, m)) : [];
    const rows = fresh.map((m) => ({ ...partRowFromMatch(m), _finding_id: finding.id }));
    const skipped = addParts ? matches.length - fresh.length : 0;
    if (onApplyCode) onApplyCode(next, rows);
    else onDiagnosticsChange(next);
    const bits = [`${picked.code} applied as finding ${next.length}`];
    if (addParts && matches.length) {
      bits.push(`${rows.length} part${rows.length === 1 ? '' : 's'} added${skipped ? `, ${skipped} already listed` : ''}`);
    }
    setNotice(bits.join(' · '));
    scrollToId.current = finding.id;
    setPicked(null);
  };
  // Bring the finding a code just added into view — on a phone it lands
  // below the fold, and the tech should see what they got.
  useEffect(() => {
    if (!scrollToId.current) return;
    const el = document.querySelector(`[data-finding-id="${scrollToId.current}"]`);
    scrollToId.current = null;
    el?.scrollIntoView({ block: 'center' });
  }, [diagnostics]);

  // ── Link a typed finding to a code ──────────────────
  // Keeps what was typed, stamps the code (so it counts and shows the chip)
  // and fills only the boxes that are still blank.
  const [linkingFor, setLinkingFor] = useState(null);   // finding id with the picker open
  const linkCode = (index, c) => {
    const d = entries[index];
    update(index, {
      code: c.code,
      diagnosis: d.diagnosis?.trim() ? d.diagnosis : c.title,
      solution: d.solution?.trim() ? d.solution : (c.solution || ''),
      parts: d.parts?.trim() ? d.parts : partsNote(c),
      customer_explanation: d.customer_explanation?.trim() ? d.customer_explanation : (c.quote_note || ''),
    });
    setLinkingFor(null);
    setNotice(`${c.code} linked to finding ${index + 1}`);
  };
  const unlinkCode = (index) => { update(index, { code: '' }); setLinkingFor(null); };

  return (
    <div className="md:col-span-2">
      {showLabel && (
        <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">
          Diagnosis &amp; Solution <span className="text-xs text-slate-400">(numbered — what was found, what it needs, and the parts for it)</span>
        </label>
      )}

      {/* Use a code from the wall: fills a finding and, via the host, the Parts list. */}
      <div className="mb-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 dark:bg-primary/10 p-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg flex-shrink-0">troubleshoot</span>
          <CodeSearch ordered={ordered} onPick={pick} placeholder="Code from the wall (HJ-03) or a symptom" ariaLabel="Use a diagnosis code" />
        </div>
        {notice && <p className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">{notice}</p>}

        {picked && (
          <div className="mt-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-3">
            <div className="flex items-start gap-2.5">
              <span className={CHIP}>{picked.code}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 dark:text-white leading-snug">{picked.title}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{picked.tool_type}</p>
              </div>
              <button type="button" onClick={() => setPicked(null)} aria-label="Cancel code" className="-mr-1.5 -mt-1.5 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            {alreadyAt >= 0 && (
              <p className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-400">Already on this tool as finding {alreadyAt + 1} — apply again only for a second, separate problem.</p>
            )}

            {picked.likely_causes?.length > 0 && (
              <div className="mt-3">
                <p className={SUB}>Likely causes — tick what you found</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {picked.likely_causes.map((cause, i) => {
                    const on = ticked.includes(i);
                    return (
                      <label key={i} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg border text-xs font-bold cursor-pointer select-none transition-colors ${on ? 'border-primary bg-primary/10 text-primary dark:text-blue-300' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400'}`}>
                        <input type="checkbox" className="sr-only" checked={on} onChange={() => setTicked((t) => (t.includes(i) ? t.filter((x) => x !== i) : [...t, i]))} />
                        <span className="material-symbols-outlined text-base">{on ? 'check_box' : 'check_box_outline_blank'}</span>
                        {cause}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {picked.technician_checks?.length > 0 && (
              <div className="mt-3">
                <p className={SUB}>Technician checks</p>
                <ul className="mt-1 text-xs text-slate-600 dark:text-slate-300 list-disc pl-4 space-y-0.5">
                  {picked.technician_checks.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className={SUB}>Repair</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200 leading-snug">{picked.solution || '—'}</p>
              </div>
              <div>
                <p className={SUB}>What we tell the customer</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200 leading-snug">{picked.quote_note || '—'}</p>
              </div>
            </div>

            {picked.parts?.length > 0 && (
              <div className="mt-3">
                <label className="inline-flex items-center gap-2 cursor-pointer min-h-[44px] sm:min-h-0">
                  <input type="checkbox" checked={addParts} onChange={(e) => setAddParts(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
                  <span className={SUB}>Add the parts to the Parts list</span>
                </label>
                <ul className="mt-1 space-y-1 text-xs">
                  {matches.map((m, i) => {
                    const listed = isPartListed(existingParts, m);
                    return (
                      <li key={i} className="flex items-start gap-2">
                        <span className={`material-symbols-outlined text-base flex-shrink-0 ${listed ? 'text-emerald-600' : m.libPart ? 'text-primary' : 'text-slate-400'}`}>{listed ? 'check_circle' : m.libPart ? 'link' : 'edit_note'}</span>
                        <span className="min-w-0">
                          <span className="font-bold text-slate-800 dark:text-slate-100">{m.name}{m.quantity > 1 ? ` ×${m.quantity}` : ''}</span>
                          <span className="block text-slate-500 dark:text-slate-400">
                            {listed
                              ? 'already on the tool'
                              : m.libPart
                                ? `${m.libPart.part_number || 'library part'}${m.libPart.suggested_price != null ? ` · $${Number(m.libPart.suggested_price).toFixed(2)}` : ''}`
                                : libraryLoading ? 'checking the parts library…' : 'not in this model’s library — added by name'}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button type="button" onClick={apply} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] sm:min-h-0 bg-primary hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-all">
                <span className="material-symbols-outlined text-base">done</span>
                {alreadyAt >= 0 ? 'Apply again' : `Apply ${picked.code}`}
              </button>
              <button type="button" onClick={() => setPicked(null)} className="inline-flex items-center justify-center px-4 py-2 min-h-[44px] sm:min-h-0 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold transition-all">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {entries.map((d, di) => {
          const showCustomer = Boolean(d.customer_explanation || d.code || customerOpen[d.id]);
          const linking = linkingFor === d.id;
          return (
            <div key={d.id} data-finding-id={d.id} className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3">
              {/* Number, title and the code (chip, or a link to attach one) on
                  the left, remove on the right. The remove button keeps its
                  44px tap target on phones but pulls its margins in so the
                  row stays one line tall. */}
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary dark:bg-primary/25 dark:text-blue-300 text-[10px] font-black flex items-center justify-center">{di + 1}</span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Finding {di + 1}</span>
                {d.code ? (
                  <button type="button" onClick={() => setLinkingFor(linking ? null : d.id)} title="Change or unlink the code" className={`${CHIP} hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors`}>{d.code}</button>
                ) : (
                  <button type="button" onClick={() => setLinkingFor(linking ? null : d.id)} className="inline-flex items-center gap-0.5 text-[11px] font-bold text-primary dark:text-blue-400 hover:underline min-h-[44px] sm:min-h-0" title="Stamp this finding with a code from the wall — keeps what you typed">
                    <span className="material-symbols-outlined text-sm">link</span>
                    Link code
                  </button>
                )}
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
              {linking && (
                <div className="mb-2.5 flex flex-wrap items-center gap-2">
                  <CodeSearch
                    ordered={ordered}
                    onPick={(c) => linkCode(di, c)}
                    placeholder="Code to link — keeps what you typed, fills the blanks"
                    ariaLabel={`Link code to finding ${di + 1}`}
                    autoFocus
                    onCancel={() => setLinkingFor(null)}
                  />
                  {d.code && (
                    <button type="button" onClick={() => unlinkCode(di)} className={NEUTRAL_BTN}>Unlink {d.code}</button>
                  )}
                  <button type="button" onClick={() => setLinkingFor(null)} className={NEUTRAL_BTN}>Cancel</button>
                </div>
              )}
              {/* Two-line boxes: these are sentences, and a single-line input
                  clips them on a phone. Three across on a desktop, stacked on
                  a phone. */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 md:gap-3">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className={SMALL_LABEL}>
                      {f.label}{f.optional && <span className="text-slate-400"> (optional)</span>}
                    </label>
                    <textarea
                      value={d[f.key] || ''}
                      onChange={(e) => update(di, { [f.key]: e.target.value })}
                      rows={rowsFor(d[f.key])}
                      placeholder={f.placeholder}
                      aria-label={`${f.label} ${di + 1}`}
                      className={BOX}
                    />
                  </div>
                ))}
              </div>
              {/* The quote wording — internal; the card shows it with a Copy button. */}
              {showCustomer ? (
                <div className="mt-2.5">
                  <label className={SMALL_LABEL}>
                    What we tell the customer <span className="text-slate-400">(optional — quote wording, internal)</span>
                  </label>
                  <textarea
                    value={d.customer_explanation || ''}
                    onChange={(e) => update(di, { customer_explanation: e.target.value })}
                    rows={rowsFor(d.customer_explanation)}
                    placeholder="The quote wording for this finding"
                    aria-label={`Customer explanation ${di + 1}`}
                    className={BOX}
                  />
                </div>
              ) : (
                <button type="button" onClick={() => setCustomerOpen((s) => ({ ...s, [d.id]: true }))} className={`${LINK_BTN} mt-1 text-xs`}>
                  <span className="material-symbols-outlined text-sm">add</span>
                  What we tell the customer
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onDiagnosticsChange([...diagnostics, { id: newDiagnosisId(), ...emptyFinding() }])}
        className={`${LINK_BTN} mt-2`}
      >
        <span className="material-symbols-outlined text-base">add</span>
        Add another diagnosis
      </button>
    </div>
  );
}
