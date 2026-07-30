/**
 * A sortable table header cell, shared by every list in route management.
 * Renders a real <button> so the header works by keyboard, and sets aria-sort
 * on the <th> so screen readers announce the current order.
 */
export default function SortableTh({ field, label, cls = '', sortBy, sortDir, onSort }) {
  const active = sortBy === field;
  return (
    <th
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`py-3 font-bold ${cls}`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 uppercase hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        {label}
        <span
          className={`material-symbols-outlined ${active ? 'opacity-90' : 'opacity-40'}`}
          style={{ fontSize: '14px' }}
        >
          {active ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
        </span>
      </button>
    </th>
  );
}
