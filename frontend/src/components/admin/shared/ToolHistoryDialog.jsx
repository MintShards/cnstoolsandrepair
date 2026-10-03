import { REPAIR_STATUSES } from '../../../constants/repairStatuses';
import { formatDateShortPacific } from '../../../utils/dateFormat';
import { daysSince, WARRANTY_DAYS, repeatSignals, partLabel } from '../../../utils/toolHistory';
import { toolDisplayTitle } from './ToolForm';

// Earlier visits of one unit, in the style of the Diagnosis and Parts
// dialogs: what the customer reported, what was found, what was replaced,
// and the outcome — without leaving the open work order.

const statusLabel = (s) => REPAIR_STATUSES[s]?.label || (s || '').replace(/_/g, ' ');
const statusCls = (s) => REPAIR_STATUSES[s]?.color || 'bg-slate-100 text-slate-600 border-slate-300';
const money = (n) => (n == null || n === '' ? null : `$${Number(n).toFixed(2)}`);

function VisitCard({ visit, isAdmin, onOpenJob, possible = false }) {
  const findings = visit.diagnostics || [];
  const parts = visit.parts || [];
  const completedAgo = visit.date_completed ? daysSince(visit.date_completed) : null;
  const inWarranty = completedAgo != null && completedAgo <= WARRANTY_DAYS;
  const models = [visit.model_number, visit.camera_head_model, visit.controller_model, visit.reel_model].filter(Boolean);
  return (
    <div className={`rounded-xl border px-4 py-3 ${possible
      ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-900/10'
      : 'border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/40'}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          type="button"
          onClick={() => onOpenJob(visit.job_id)}
          className="font-mono font-bold text-sm text-primary hover:underline min-h-[44px] sm:min-h-0"
          title="Open this work order"
        >
          {visit.work_order}
        </button>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${statusCls(visit.status)}`}>{statusLabel(visit.status)}</span>
        {inWarranty && (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold border bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700/50">
            Within {WARRANTY_DAYS}-day warranty
          </span>
        )}
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {visit.date_received ? `Received ${formatDateShortPacific(visit.date_received)}` : ''}
          {visit.date_completed ? ` · Completed ${formatDateShortPacific(visit.date_completed)} (${completedAgo === 0 ? 'today' : `${completedAgo} days ago`})` : ''}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 uppercase">
        {visit.company_name || visit.customer_name}
        {models.length > 0 && ` · ${[visit.brand, ...models].filter(Boolean).join(' ')}`}
        {possible && ' · same customer and model, no serial match'}
        {!possible && visit.matched_serials?.length > 0 && ` · matched S/N ${visit.matched_serials.join(', ')}`}
      </p>

      <div className="mt-3 space-y-2.5">
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Reported problem</span>
          <p className={`text-sm whitespace-pre-wrap ${visit.remarks ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600 italic'}`}>
            {visit.remarks || 'Nothing recorded'}
          </p>
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Findings</span>
          {findings.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-600 italic">None recorded</p>
          ) : (
            <ol className="list-decimal pl-5 space-y-1">
              {findings.map((d, i) => (
                <li key={d.id || i} className="text-sm text-slate-700 dark:text-slate-200">
                  {d.code && <span className="font-mono text-xs font-bold text-violet-700 dark:text-violet-300 mr-1.5">{d.code}</span>}
                  {d.diagnosis}
                  {d.solution && <span className="text-slate-500 dark:text-slate-400"> — {d.solution}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Parts</span>
          {parts.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-600 italic">No parts</p>
          ) : (
            <ul className="space-y-0.5">
              {parts.map((p, i) => (
                <li key={`${p.name}-${i}`} className="text-sm text-slate-700 dark:text-slate-200">
                  {partLabel(p)}{p.quantity > 1 ? ` ×${p.quantity}` : ''}
                  {p.status && <span className="text-xs text-slate-400 dark:text-slate-500"> · {p.status.replace(/_/g, ' ')}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {visit.labour_hours != null && visit.labour_hours !== '' ? `Labour ${visit.labour_hours} h` : 'Labour —'}
          {' · '}{visit.assigned_technician ? `Tech ${visit.assigned_technician}` : 'Tech —'}
          {isAdmin && money(visit.invoiced_amount) && ` · Invoiced ${money(visit.invoiced_amount)}`}
          {visit.warranty && ' · Warranty job'}
        </p>
      </div>
    </div>
  );
}

export default function ToolHistoryDialog({ tool, history, isAdmin, onClose, onOpenJob }) {
  const matches = history?.matches || [];
  const possible = history?.possible || [];
  const signals = repeatSignals(tool, matches);
  const lastCompleted = matches
    .filter((m) => m.date_completed)
    .sort((a, b) => new Date(b.date_completed) - new Date(a.date_completed))[0];
  const lastAgo = lastCompleted ? daysSince(lastCompleted.date_completed) : null;
  const inWarranty = lastAgo != null && lastAgo <= WARRANTY_DAYS;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full my-8 border border-slate-200/50 dark:border-slate-700/50 shadow-2xl shadow-black/10 dark:shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30" />
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700/60">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary text-lg">history</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">History</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{toolDisplayTitle(tool).toUpperCase()}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all flex-shrink-0" aria-label="Close">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Where this visit stands — the number, the warranty clock, and
              what repeats from earlier visits. */}
          <div className={`rounded-lg border px-3 py-2.5 ${inWarranty
            ? 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-800/50'
            : matches.length ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-800/50'
              : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/60'}`}>
            <p className={`text-sm font-bold ${inWarranty ? 'text-red-700 dark:text-red-400' : matches.length ? 'text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}>
              {matches.length === 0
                ? (possible.length ? 'No confirmed earlier visit — see the possible ones below' : 'First visit of this unit')
                : `Visit ${matches.length + 1} of this unit`}
              {lastCompleted && ` · last completed ${lastAgo === 0 ? 'today' : `${lastAgo} days ago`} on ${lastCompleted.work_order}`}
              {inWarranty && ' · within the 90-day warranty'}
            </p>
            {signals.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {signals.map((s) => (
                  <li key={s} className="text-sm text-slate-700 dark:text-slate-200 flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-base text-amber-600 dark:text-amber-400 flex-shrink-0">repeat</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {matches.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Previous visits ({matches.length}) · matched by serial
              </p>
              {matches.map((v) => (
                <VisitCard key={`${v.job_id}-${v.tool_id}`} visit={v} isAdmin={isAdmin} onOpenJob={onOpenJob} />
              ))}
            </div>
          )}

          {possible.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Possibly this unit ({possible.length})
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
                {"The same customer's earlier tools of this model whose serial didn't match — a job from before house serials, or a serial typed differently. Check before relying on them."}
              </p>
              {possible.map((v) => (
                <VisitCard key={`${v.job_id}-${v.tool_id}`} visit={v} isAdmin={isAdmin} onOpenJob={onOpenJob} possible />
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700/60 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 min-h-[44px] sm:min-h-0 rounded-xl text-sm font-bold bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
