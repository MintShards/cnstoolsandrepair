import { useState, useEffect, useCallback } from 'react';
import { sourcingAPI } from '../../../../services/api';
import PaginationBar from '../../shared/PaginationBar';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const statusColors = {
  sent: 'text-green-600 dark:text-green-400 bg-green-500/10',
  partial_failure: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10',
  failed: 'text-red-600 dark:text-red-400 bg-red-500/10',
};

export default function SourcingHistory() {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadPage = useCallback(async (p, size) => {
    setLoading(true);
    try {
      const data = await sourcingAPI.getHistory(p, size);
      setHistory(data);
      setPage(p);
    } catch {
      setHistory(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!expanded) return;
    loadPage(1, pageSize);
  }, [expanded, loadPage, pageSize]);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors w-full"
      >
        <span className="material-symbols-outlined text-base">
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
        Sourcing history
        {!expanded && (
          <span className="text-xs text-slate-400 dark:text-slate-600">(click to load)</span>
        )}
        {expanded && history && (
          <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full font-semibold">
            {history.total}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-3">
          {loading && (
            <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm">Loading history...</div>
          )}

          {!loading && history && history.items.length === 0 && (
            <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm">No sourcing emails sent yet.</div>
          )}

          {!loading && history && history.items.length > 0 && (
            <>
              <div className="space-y-2">
                {history.items.map((item) => (
                  <div key={item.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                      className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[item.status] || 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                          {item.status.replace('_', ' ')}
                        </span>
                        <span className="text-sm text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-none">{item.subject}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                        <span>{item.sent_count} sent{item.failed_count > 0 ? `, ${item.failed_count} failed` : ''}</span>
                        <span>{item.parts?.length ?? 0} parts</span>
                        <span>{formatDate(item.sent_at)}</span>
                      </div>
                    </button>

                    {expandedItem === item.id && (
                      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 text-sm space-y-3">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Recipients:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.recipients?.map((r, i) => (
                              <span key={i} className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-xs">
                                {r.name ? `${r.name} <${r.email}>` : r.email}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Parts ({item.parts?.length ?? 0}):</p>
                          <div className="space-y-1">
                            {item.parts?.map((p, i) => (
                              <div key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-700 dark:text-slate-300">
                                <span className="font-medium">{p.name}</span>
                                {p.part_number && <span className="text-slate-400 dark:text-slate-500">{p.part_number}</span>}
                                <span className="text-slate-400 dark:text-slate-500">×{p.quantity}</span>
                                {p.request_number && <span className="text-primary">{p.request_number}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                        {item.message && (
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Message:</p>
                            <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line">{item.message}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <PaginationBar
                currentPage={page}
                totalItems={history.total}
                pageSize={pageSize}
                onPageChange={(p) => loadPage(p, pageSize)}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1); loadPage(1, size); }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
