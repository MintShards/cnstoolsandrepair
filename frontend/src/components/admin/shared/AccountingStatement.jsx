// Money as a short statement — up to three columns (charged, cost, result)
// of label/value rows, the last row of each column its total. The job's
// totals use it at the top of the work order dialog; each tool uses it under
// its details. Columns stack on phones.

const COLS = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' };

/** One column: a heading and rows of { label, value, strong?, tone?, hint? }. */
export function Column({ title, rows }) {
  return (
    <div className="rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-700/40 px-3 py-2 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{title}</p>
      <dl className="space-y-1 text-xs">
        {rows.map((r) => (
          <div
            key={r.label}
            className={`flex items-baseline justify-between gap-3 ${r.strong ? 'pt-1 mt-1 border-t border-slate-200 dark:border-slate-700/60' : ''}`}
          >
            <dt className={`min-w-0 truncate ${r.strong ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`} title={r.hint}>{r.label}</dt>
            <dd className={`whitespace-nowrap tabular-nums ${r.strong ? 'text-sm font-black' : 'font-bold'} ${r.tone || (r.strong ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200')}`} title={r.hint}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function AccountingStatement({ columns }) {
  const cols = columns.filter(Boolean);
  return (
    <div className={`grid grid-cols-1 ${COLS[cols.length] || 'sm:grid-cols-3'} gap-2`}>
      {cols.map((c) => <Column key={c.title} title={c.title} rows={c.rows} />)}
    </div>
  );
}
