import { INTEREST_META } from './ui';

// Interest rendered the repair-tracker way: a coloured dot beside neutral
// text instead of a coloured pill — the signal stays, the noise goes.
export default function InterestDot({ level, withLabel = true, className = '' }) {
  const meta = INTEREST_META[level] || INTEREST_META.cold;
  return (
    <span
      title={`${meta.label} lead`}
      className={`inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 ${className}`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
      {withLabel && meta.label}
    </span>
  );
}
