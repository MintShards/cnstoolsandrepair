import { useState, useEffect, useRef, useCallback } from 'react';
import { partsLibraryAPI } from '../../../services/api';

/**
 * PartLibraryPicker
 *
 * Props:
 *   onSelect(partData)  — called with { name, part_number, library_part_id, supplier, price, order_link, notes }
 *   onClose()           — called when the user dismisses the modal
 */
export default function PartLibraryPicker({ onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [compatParts, setCompatParts] = useState(null);
  const [loadingCompat, setLoadingCompat] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // Focus search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setSearching(false); return; }
    setSearching(true);
    try {
      const data = await partsLibraryAPI.search(q.trim(), 30);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedPart(null);
    setCompatParts(null);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelectResult = async (part) => {
    setSelectedPart(part);
    setCompatParts(null);
    if (part.compatibility_group_ids?.length > 0) {
      setLoadingCompat(true);
      try {
        const data = await partsLibraryAPI.getCompatibleParts(part.id);
        setCompatParts(data);
      } catch {
        setCompatParts(null);
      } finally {
        setLoadingCompat(false);
      }
    }
  };

  const handlePickPart = (part) => {
    const supplier = part.suggested_suppliers?.[0] || '';
    const price = part.suggested_price != null ? String(part.suggested_price) : '';
    const order_link = part.order_url || '';
    onSelect({
      name: part.name || '',
      part_number: part.part_number || '',
      library_part_id: part.id,
      supplier,
      price,
      order_link,
      notes: part.notes || '',
    });
    onClose();
  };

  const totalCompat = compatParts
    ? compatParts.compatibility_groups?.reduce((acc, g) => acc + g.parts.length, 0)
    : 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary text-xl">inventory_2</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-base text-slate-900 dark:text-white">Find Part in Library</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Search by part name, number, or description</p>
          </div>
          <button onClick={onClose}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex-shrink-0">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 focus-within:border-primary dark:focus-within:border-primary/60 transition-colors">
            <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-xl flex-shrink-0">
              {searching ? 'refresh' : 'search'}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              placeholder="Search parts…"
              className="flex-1 py-2.5 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none"
            />
            {query && (
              <button onClick={() => { setQuery(''); setResults([]); setSelectedPart(null); setCompatParts(null); inputRef.current?.focus(); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <span className="material-symbols-outlined" style={{fontSize:'18px'}}>close</span>
              </button>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Empty state */}
          {!query.trim() && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-3xl">manage_search</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Start typing to search the parts library</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Try part numbers, names, or descriptions</p>
            </div>
          )}

          {/* No results */}
          {query.trim() && !searching && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-5xl mb-2">search_off</span>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No parts found for "{query}"</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Try a different search term or part number</p>
            </div>
          )}

          {/* Results + detail pane */}
          {results.length > 0 && !selectedPart && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {results.map((part) => (
                <button
                  key={part.id}
                  onClick={() => handleSelectResult(part)}
                  className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-base">settings</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{part.name}</span>
                      {part.part_number && (
                        <span className="text-xs font-mono text-primary dark:text-primary/80 bg-primary/8 dark:bg-primary/15 px-1.5 py-0.5 rounded flex-shrink-0">
                          {part.part_number}
                        </span>
                      )}
                      {part.ref_number && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">Ref #{part.ref_number}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {part.brand_name && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">{part.brand_name}</span>
                      )}
                      {part.model_names?.length > 0 && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {part.model_names.slice(0, 2).join(', ')}{part.model_names.length > 2 ? ` +${part.model_names.length - 2}` : ''}
                        </span>
                      )}
                      {part.suggested_price != null && (
                        <span className="text-xs font-bold text-green-600 dark:text-green-400">${Number(part.suggested_price).toFixed(2)}</span>
                      )}
                      {part.compatibility_group_ids?.length > 0 && (
                        <span className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <span className="material-symbols-outlined" style={{fontSize:'11px'}}>hub</span>
                          {part.compatibility_group_ids.length} compat
                        </span>
                      )}
                    </div>
                    {part.description && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{part.description}</p>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 flex-shrink-0 mt-1 text-lg">chevron_right</span>
                </button>
              ))}
            </div>
          )}

          {/* Part detail + compatible alternatives */}
          {selectedPart && (
            <div className="flex flex-col">
              {/* Back button */}
              <button
                onClick={() => { setSelectedPart(null); setCompatParts(null); }}
                className="flex items-center gap-1.5 px-5 py-3 text-sm text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors border-b border-slate-100 dark:border-slate-800"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Back to results
              </button>

              {/* Part card */}
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-black text-base text-slate-900 dark:text-white">{selectedPart.name}</h3>
                      {selectedPart.part_number && (
                        <span className="text-sm font-mono font-bold text-primary bg-primary/10 dark:bg-primary/20 px-2 py-0.5 rounded">
                          {selectedPart.part_number}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      {selectedPart.brand_name && <span className="font-medium">{selectedPart.brand_name}</span>}
                      {selectedPart.model_names?.length > 0 && (
                        <span>{selectedPart.model_names.join(', ')}</span>
                      )}
                      {selectedPart.ref_number && <span>Ref #{selectedPart.ref_number}</span>}
                      {selectedPart.category && <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{selectedPart.category}</span>}
                    </div>
                    {selectedPart.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{selectedPart.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 flex-wrap text-xs">
                      {selectedPart.suggested_price != null && (
                        <span className="font-bold text-green-600 dark:text-green-400 text-sm">${Number(selectedPart.suggested_price).toFixed(2)}</span>
                      )}
                      {selectedPart.suggested_suppliers?.length > 0 && (
                        <span className="text-slate-500 dark:text-slate-400">
                          <span className="text-slate-400 dark:text-slate-500">Supplier: </span>
                          {selectedPart.suggested_suppliers.join(', ')}
                        </span>
                      )}
                      {selectedPart.order_url && (
                        <a href={selectedPart.order_url.startsWith('http') ? selectedPart.order_url : `https://${selectedPart.order_url}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-primary dark:text-primary/80 hover:underline flex items-center gap-0.5">
                          <span className="material-symbols-outlined" style={{fontSize:'13px'}}>open_in_new</span>
                          Order
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handlePickPart(selectedPart)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-base">add_circle</span>
                    Use This Part
                  </button>
                </div>
              </div>

              {/* Compatible alternatives */}
              {loadingCompat && (
                <div className="flex items-center gap-2 px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  Loading compatible alternatives…
                </div>
              )}

              {!loadingCompat && selectedPart.compatibility_group_ids?.length > 0 && compatParts && (
                <div className="px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-violet-500">hub</span>
                    Compatible Alternatives
                    {totalCompat > 0 && (
                      <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-bold px-1.5 py-0.5 rounded ml-1">{totalCompat}</span>
                    )}
                  </p>
                  {totalCompat === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500 italic">No other compatible parts found.</p>
                  ) : (
                    <div className="space-y-4">
                      {compatParts.compatibility_groups?.map((group) => (
                        <div key={group.group.id}>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                            <span className="material-symbols-outlined" style={{fontSize:'13px'}}>category</span>
                            {group.group.name}
                          </p>
                          <div className="space-y-1.5">
                            {group.parts.map((cp) => (
                              <div key={cp.id}
                                className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-2.5 border border-slate-200 dark:border-slate-700">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{cp.name}</span>
                                    {cp.part_number && (
                                      <span className="text-xs font-mono text-primary dark:text-primary/80 bg-primary/8 dark:bg-primary/15 px-1.5 py-0.5 rounded">
                                        {cp.part_number}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex-wrap">
                                    {cp.brand_name && <span>{cp.brand_name}</span>}
                                    {cp.model_names?.length > 0 && <span>{cp.model_names.slice(0, 2).join(', ')}</span>}
                                    {cp.suggested_price != null && (
                                      <span className="font-bold text-green-600 dark:text-green-400">${Number(cp.suggested_price).toFixed(2)}</span>
                                    )}
                                    {cp.order_url && (
                                      <a href={cp.order_url.startsWith('http') ? cp.order_url : `https://${cp.order_url}`}
                                        target="_blank" rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-primary hover:underline flex items-center gap-0.5">
                                        <span className="material-symbols-outlined" style={{fontSize:'11px'}}>open_in_new</span>
                                        Order
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handlePickPart(cp)}
                                  className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-slate-200 hover:bg-primary dark:bg-slate-700 dark:hover:bg-primary text-slate-700 dark:text-slate-300 hover:text-white dark:hover:text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                  <span className="material-symbols-outlined" style={{fontSize:'14px'}}>add</span>
                                  Use
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!loadingCompat && !selectedPart.compatibility_group_ids?.length && (
                <div className="px-5 py-4">
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic">No compatibility groups assigned to this part.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {results.length > 0 && !selectedPart ? `${results.length} result${results.length !== 1 ? 's' : ''}` : ''}
            {selectedPart ? 'Selecting will auto-fill the part fields' : ''}
          </p>
          <button onClick={onClose}
            className="px-4 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
