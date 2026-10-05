import { FILTER_INPUT } from '../sales/ui';
import { PERIOD_PRESETS, presetRange } from '../../utils/accounting';

/**
 * Today / This week / This month / Custom, plus the two dates. Picking a
 * preset sets the dates; touching a date makes the range custom. The parent
 * holds { preset, from, to } and gets the whole object back on every change.
 */
export default function PeriodPicker({ value, onChange, label = 'Period', className = '' }) {
  const { preset, from, to } = value;
  const pick = (id) => onChange(id === 'custom' ? { preset: 'custom', from, to } : { preset: id, ...presetRange(id) });
  const setDate = (key, v) => {
    if (!v) return;
    const next = { ...value, preset: 'custom', [key]: v };
    // Keep the range in order whichever end was moved.
    if (next.from > next.to) {
      if (key === 'from') next.to = v;
      else next.from = v;
    }
    onChange(next);
  };
  return (
    // sm+ puts the dates beside the presets and lets them drop underneath
    // when the row is too narrow (a tablet's main column beside the rail).
    <div className={`flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 ${className}`} role="group" aria-label={label}>
      {/* Neither group ever squeezes: in a wrapping toolbar the row breaks
          before a preset label would ("This / week"). Phones keep the four
          presets in equal cells, where a label may wrap whole. */}
      <div className="grid grid-cols-4 sm:inline-flex shrink-0 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
        {PERIOD_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => pick(p.id)}
            aria-pressed={preset === p.id}
            className={`px-2 sm:px-3 py-2.5 min-h-11 sm:min-h-0 text-xs sm:text-sm font-bold sm:whitespace-nowrap transition-colors ${
              preset === p.id
                ? 'bg-primary text-white'
                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:flex shrink-0 gap-2 items-center">
        <input type="date" value={from} max={to} onChange={(e) => setDate('from', e.target.value)} aria-label="From" className={FILTER_INPUT} />
        <input type="date" value={to} min={from} onChange={(e) => setDate('to', e.target.value)} aria-label="To" className={FILTER_INPUT} />
      </div>
    </div>
  );
}
