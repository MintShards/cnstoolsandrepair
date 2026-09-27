import { useState, useEffect, useCallback, useMemo } from 'react';
import { diagnosisCodesAPI, repairsAPI } from '../../../services/api';
import { ToastProvider, useToast } from '../shared/ToastProvider';
import { apiErrorMessage } from '../../../utils/apiError';
import TabHeader from '../../sales/TabHeader';
import { BTN_PRIMARY, BTN_NEUTRAL, FILTER_INPUT } from '../../sales/ui';
import ConfirmModal from '../../sales/ConfirmModal';
import DiagnosisCodeFormModal from './DiagnosisCodeFormModal';
import { openPrintDiagnosisCodes } from '../PrintDiagnosisCodes';
import { groupCodes, codeMatches, categoryLabel } from '../../../constants/diagnosisCodes';

const CODE_CHIP = 'inline-flex items-center px-2 py-0.5 rounded-md border-2 border-slate-900 dark:border-slate-100 font-mono font-black text-sm text-slate-900 dark:text-white';
const ROW_BTN = 'inline-flex items-center justify-center gap-1 px-2.5 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-600/50 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all';

/**
 * The internal library of common tool problems, one code each, grouped by
 * tool type the way the wall chart is. Admins add, edit and retire codes
 * here; techs use them from the tracker. Printing gives the wall index
 * (code + symptom, big type) or the full reference chart.
 */
function DiagnosisCodesInner() {
  const showToast = useToast();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toolTypes, setToolTypes] = useState([]);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showRetired, setShowRetired] = useState(false);
  const [formCode, setFormCode] = useState(undefined);   // undefined closed · null new · object edit
  const [retiring, setRetiring] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCodes(await diagnosisCodesAPI.list({ active_only: !showRetired }));
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Could not load the diagnosis codes.'));
    } finally {
      setLoading(false);
    }
  }, [showRetired, showToast]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    repairsAPI.toolTypes()
      .then((d) => setToolTypes(Array.isArray(d?.tool_types) ? d.tool_types : []))
      .catch(() => {});
  }, []);

  // Every section and tool type in the library, for the filter's option groups.
  const allGroups = useMemo(() => groupCodes(codes), [codes]);
  const visible = useMemo(
    () => codes.filter((c) => (!typeFilter || c.tool_type === typeFilter) && codeMatches(c, q)),
    [codes, typeFilter, q],
  );
  const groups = useMemo(() => groupCodes(visible), [visible]);
  const filtered = Boolean(q.trim() || typeFilter);
  const printable = (filtered ? visible : codes).filter((c) => c.active !== false);

  const handleSaved = (saved) => {
    setCodes((prev) => (prev.some((c) => c.id === saved.id) ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved]));
    setFormCode(undefined);
  };

  const handleRetire = async () => {
    const target = retiring;
    setRetiring(null);
    try {
      await diagnosisCodesAPI.retire(target.id);
      setCodes((prev) => (showRetired ? prev.map((c) => (c.id === target.id ? { ...c, active: false } : c)) : prev.filter((c) => c.id !== target.id)));
      showToast('success', `${target.code} retired — old findings keep it, the number stays taken`);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Could not retire the code.'));
    }
  };

  const handleRestore = async (c) => {
    try {
      const saved = await diagnosisCodesAPI.update(c.id, { active: true });
      setCodes((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      showToast('success', `${saved.code} is back on the chart`);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Could not restore the code.'));
    }
  };

  const print = (mode, includeQuoteNotes = false) => {
    setPrintOpen(false);
    if (!printable.length) { showToast('error', 'Nothing to print yet.'); return; }
    openPrintDiagnosisCodes(printable, { mode, includeQuoteNotes });
  };

  return (
    <div className="space-y-5">
      <TabHeader
        title="Diagnosis Codes"
        subtitle="Common problems by code — symptom, likely causes, checks, repair, parts and the quote wording. Internal: for the wall and the tracker."
        action={(
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <button type="button" onClick={() => setPrintOpen((v) => !v)} className={`${BTN_NEUTRAL} w-full min-h-[44px] sm:min-h-0`} aria-haspopup="menu" aria-expanded={printOpen}>
                <span className="material-symbols-outlined text-base">print</span>
                Print
              </button>
              {printOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setPrintOpen(false)} aria-hidden="true" />
                  <div role="menu" className="absolute right-0 mt-2 w-72 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                    <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{printable.length} code{printable.length === 1 ? '' : 's'}{filtered ? ' (filtered)' : ''}</p>
                    {[
                      { label: 'Wall index', hint: 'Code and problem, big type, one page per tool type', run: () => print('index') },
                      { label: 'Full reference chart', hint: 'Causes, checks, repair and parts', run: () => print('full') },
                      { label: 'Full chart with quote notes', hint: 'Adds the customer wording column', run: () => print('full', true) },
                    ].map((item) => (
                      <button key={item.label} type="button" role="menuitem" onClick={item.run} className="w-full text-left px-4 py-2.5 min-h-[44px] hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors">
                        <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{item.label}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{item.hint}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button type="button" onClick={() => setFormCode(null)} className={`${BTN_PRIMARY} flex-1 sm:flex-none min-h-[44px] sm:min-h-0`}>
              <span className="material-symbols-outlined text-base">add</span>
              Add code
            </button>
          </div>
        )}
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, symptom, cause…"
            className={`${FILTER_INPUT} sm:w-72`}
          />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={FILTER_INPUT} aria-label="Tool type">
            <option value="">All tool types</option>
            {allGroups.map((g) => (
              <optgroup key={g.category} label={categoryLabel(g.category)}>
                {g.types.map((t) => <option key={t.toolType} value={t.toolType}>{t.toolType}</option>)}
              </optgroup>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 min-h-[44px] sm:min-h-0 cursor-pointer">
            <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
            Show retired
          </label>
        </div>
      </TabHeader>

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading codes…</p>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">troubleshoot</span>
          <p className="mt-2 font-bold text-slate-700 dark:text-slate-200">{codes.length ? 'No codes match' : 'No diagnosis codes yet'}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {codes.length ? 'Try another search or tool type.' : 'Add the first one — a symptom, what usually causes it, what to check, the repair, the parts and what to tell the customer.'}
          </p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.category} className="rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 overflow-hidden">
            <header className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/60">
              <span className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black flex items-center justify-center">{g.letter}</span>
              <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{g.category}</h3>
              <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">{g.count} code{g.count === 1 ? '' : 's'}</span>
            </header>
            {g.types.map((t) => (
            <div key={t.toolType}>
            <p className="px-4 pt-3 pb-1 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-t first:border-t-0 border-slate-100 dark:border-slate-800">{t.toolType}</p>
            <ul>
              {t.codes.map((c) => (
                <li key={c.id} className={`grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] gap-x-3 gap-y-2 px-4 py-3 border-t first:border-t-0 border-slate-100 dark:border-slate-800 ${c.active === false ? 'opacity-60' : ''}`}>
                  <div className="flex flex-col items-start gap-1">
                    <span className={CODE_CHIP}>{c.code}</span>
                    {c.active === false && <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Retired</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white leading-snug">{c.title}</p>
                    {c.likely_causes?.length > 0 && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                        {c.likely_causes.slice(0, 3).join(' · ')}{c.likely_causes.length > 3 ? ` · +${c.likely_causes.length - 3} more` : ''}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {c.parts?.length ? `${c.parts.length} part${c.parts.length === 1 ? '' : 's'}` : 'No parts'}
                      {' · '}
                      {c.usage_count ? `used ${c.usage_count}×` : 'not used yet'}
                      {c.quote_note ? ' · quote note' : ''}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex sm:flex-col gap-2 sm:justify-start">
                    <button type="button" onClick={() => setFormCode(c)} className={`${ROW_BTN} flex-1 sm:flex-none`}>
                      <span className="material-symbols-outlined text-base">edit</span>
                      Edit
                    </button>
                    {c.active === false ? (
                      <button type="button" onClick={() => handleRestore(c)} className={`${ROW_BTN} flex-1 sm:flex-none`}>
                        <span className="material-symbols-outlined text-base">restore</span>
                        Restore
                      </button>
                    ) : (
                      <button type="button" onClick={() => setRetiring(c)} className={`${ROW_BTN} flex-1 sm:flex-none hover:text-red-600 dark:hover:text-red-400`}>
                        <span className="material-symbols-outlined text-base">archive</span>
                        Retire
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            </div>
            ))}
          </section>
        ))
      )}

      {formCode !== undefined && (
        <DiagnosisCodeFormModal code={formCode} toolTypes={toolTypes} onSaved={handleSaved} onClose={() => setFormCode(undefined)} />
      )}
      {retiring && (
        <ConfirmModal
          message={`Retire ${retiring.code} — ${retiring.title}? It leaves the wall chart and the picker; findings that used it keep it, and the number is not reused.`}
          confirmLabel="Retire"
          onConfirm={handleRetire}
          onCancel={() => setRetiring(null)}
        />
      )}
    </div>
  );
}

export default function DiagnosisCodesTab() {
  return (
    <ToastProvider>
      <DiagnosisCodesInner />
    </ToastProvider>
  );
}
