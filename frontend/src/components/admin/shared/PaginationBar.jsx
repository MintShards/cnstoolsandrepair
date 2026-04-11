/**
 * Unified pagination bar for all admin tables.
 * Always visible when there are items, regardless of whether items exceed page size.
 * On phone: compact prev/next + "Page X of Y" + per-page select in a single row.
 * On md+: full page-number buttons layout.
 */

const getPageNumbers = (current, total) => {
  const pages = [];
  if (total <= 5) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else if (current <= 3) {
    pages.push(1, 2, 3, 4, '...', total);
  } else if (current >= total - 2) {
    pages.push(1, '...', total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total);
  }
  return pages;
};

export default function PaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 25, 50, 100],
}) {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;

  const prevBtn = (extraClass = '') => (
    <button
      onClick={() => onPageChange(Math.max(1, currentPage - 1))}
      disabled={currentPage === 1}
      className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all ${extraClass}`}
    >
      <span className="material-symbols-outlined text-sm">chevron_left</span>
    </button>
  );

  const nextBtn = (extraClass = '') => (
    <button
      onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
      disabled={currentPage === totalPages}
      className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all ${extraClass}`}
    >
      <span className="material-symbols-outlined text-sm">chevron_right</span>
    </button>
  );

  const perPageSelect = (
    <div className="flex items-center gap-1.5">
      <label className="text-xs text-slate-500 whitespace-nowrap">Per page:</label>
      <select
        value={pageSize}
        onChange={(e) => {
          onPageSizeChange(parseInt(e.target.value));
          onPageChange(1);
        }}
        className="px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-lg text-slate-700 dark:text-white text-xs focus:outline-none focus:border-primary transition-all"
      >
        {pageSizeOptions.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="border-t border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/30">
      {/* ── Phone layout (< md): single compact row ── */}
      <div className="flex md:hidden items-center justify-between gap-2 px-3 py-2.5">
        {prevBtn()}
        <div className="flex items-center gap-2 flex-1 justify-center">
          <span className="text-xs text-slate-500 whitespace-nowrap">
            Page <span className="font-bold text-slate-700 dark:text-slate-300">{currentPage}</span> of <span className="font-bold text-slate-700 dark:text-slate-300">{totalPages}</span>
          </span>
        </div>
        {nextBtn()}
        {perPageSelect}
      </div>

      {/* ── Tablet / Desktop layout (md+): three-section row ── */}
      <div className="hidden md:flex items-center justify-between gap-3 px-5 py-3">
        <div className="text-xs text-slate-500">
          Showing{' '}
          <span className="text-slate-700 dark:text-slate-300 font-bold">{startIndex + 1}</span>–
          <span className="text-slate-700 dark:text-slate-300 font-bold">{Math.min(startIndex + pageSize, totalItems)}</span>{' '}
          of <span className="text-slate-700 dark:text-slate-300 font-bold">{totalItems}</span>
        </div>

        <div className="flex items-center gap-1">
          {prevBtn()}
          {getPageNumbers(currentPage, totalPages).map((page, idx) => (
            page === '...' ? (
              <span key={`e-${idx}`} className="w-8 text-center text-slate-400 dark:text-slate-600 text-sm">…</span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`w-8 h-8 rounded-lg font-bold text-xs transition-all ${
                  currentPage === page
                    ? 'bg-primary text-white shadow-sm shadow-primary/20'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {page}
              </button>
            )
          ))}
          {nextBtn()}
        </div>

        {perPageSelect}
      </div>
    </div>
  );
}
