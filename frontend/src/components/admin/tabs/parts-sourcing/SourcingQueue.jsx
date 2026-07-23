import { useState, useEffect, useRef, useCallback } from 'react';
import PaginationBar from '../../shared/PaginationBar';
import { partsLibraryAPI } from '../../../../services/api';

const EMPTY_SUGGEST = { idx: null, anchor: null, results: [], loading: false, highlight: -1, rect: null };

export default function SourcingQueue({ items, selected, onToggle, onSelectAll, onRemove, onRemoveSelected, manualParts, onManualPartsChange, onUpdateQuantity }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [touched, setTouched] = useState({}); // "idx-field" -> true

  const touch = (idx, field) => setTouched((prev) => ({ ...prev, [`${idx}-${field}`]: true }));
  const isTouched = (idx, field) => !!touched[`${idx}-${field}`];

  // Reset to page 1 when items list changes
  useEffect(() => {
    setPage(1);
  }, [items.length]);

  const validManualCount = manualParts.filter((p) => p.name.trim() && p.part_number?.trim()).length;
  const totalSelectable = items.length + validManualCount;
  const allSelected = totalSelectable > 0 && selected.size === totalSelectable;
  const pagedItems = items.slice((page - 1) * pageSize, page * pageSize);

  const addManualRow = () => {
    onManualPartsChange([...manualParts, { name: '', part_number: '', quantity: 1 }]);
  };

  const updateManualRow = (idx, field, value) => {
    onManualPartsChange(manualParts.map((p, i) => {
      if (i !== idx) return p;
      const next = { ...p, [field]: value };
      // Manual edits break the link to the library part that filled the row
      if (field === 'name' || field === 'part_number') delete next.library_part_id;
      return next;
    }));
  };

  const removeManualRow = (idx, part) => {
    onRemove({ manual: true, index: idx, part });
  };

  // ── Parts-library autocomplete for manual rows ─────────────────────────────
  const [suggest, setSuggest] = useState(EMPTY_SUGGEST);
  const searchTimer = useRef(null);
  const searchSeq = useRef(0);
  const dropdownRef = useRef(null);

  const closeSuggest = useCallback(() => {
    clearTimeout(searchTimer.current);
    searchSeq.current++;
    setSuggest(EMPTY_SUGGEST);
  }, []);

  const triggerSuggest = (idx, anchor, value, inputEl) => {
    clearTimeout(searchTimer.current);
    const q = value.trim();
    const rect = inputEl.getBoundingClientRect();
    setSuggest((s) => ({
      ...s,
      idx,
      anchor,
      rect,
      highlight: -1,
      results: s.idx === idx && s.anchor === anchor ? s.results : [],
      loading: false,
    }));
    const seq = ++searchSeq.current;
    if (q.length < 2) return;
    searchTimer.current = setTimeout(async () => {
      setSuggest((s) => (s.idx === idx && s.anchor === anchor ? { ...s, loading: true } : s));
      let results = [];
      try {
        results = await partsLibraryAPI.search(q, 8);
      } catch {
        results = [];
      }
      if (searchSeq.current === seq) {
        setSuggest((s) => (s.idx === idx && s.anchor === anchor ? { ...s, results, loading: false } : s));
      }
    }, 300);
  };

  const applySuggestion = (idx, libPart) => {
    onManualPartsChange(manualParts.map((p, i) => i === idx
      ? {
          ...p,
          name: (libPart.name || '').toUpperCase(),
          part_number: (libPart.part_number || '').toUpperCase(),
          library_part_id: libPart.id,
        }
      : p));
    closeSuggest();
  };

  const handleSuggestKeyDown = (e, idx) => {
    const isOpen = suggest.idx === idx && (suggest.results.length > 0 || suggest.loading);
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggest((s) => ({ ...s, highlight: s.results.length ? (s.highlight + 1) % s.results.length : -1 }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggest((s) => ({ ...s, highlight: s.results.length ? (s.highlight <= 0 ? s.results.length - 1 : s.highlight - 1) : -1 }));
    } else if (e.key === 'Enter') {
      if (suggest.highlight >= 0 && suggest.results[suggest.highlight]) {
        e.preventDefault();
        applySuggestion(idx, suggest.results[suggest.highlight]);
      }
    } else if (e.key === 'Escape') {
      closeSuggest();
    }
  };

  // The dropdown is position:fixed (so the table's overflow container can't
  // clip it) — close it when anything else scrolls or the window resizes.
  useEffect(() => {
    if (suggest.idx === null) return undefined;
    const onScroll = (e) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) return;
      closeSuggest();
    };
    const onResize = () => closeSuggest();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [suggest.idx, closeSuggest]);

  const isEmpty = items.length === 0 && manualParts.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-3">
          {items.length > 0 && (
            <span className="text-sm text-slate-500 dark:text-slate-400">{items.length} part{items.length !== 1 ? 's' : ''} in queue</span>
          )}
          {totalSelectable > 0 && (
            <button
              onClick={() => onSelectAll(!allSelected)}
              className="text-xs text-primary hover:underline"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}
          {selected.size > 0 && (
            <button
              onClick={onRemoveSelected}
              className="text-xs text-red-500 hover:underline"
            >
              Remove selected ({selected.size})
            </button>
          )}
        </div>
        <button
          onClick={addManualRow}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Add manual part
        </button>
      </div>

      {isEmpty ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <span className="material-symbols-outlined text-4xl block mb-2">inventory_2</span>
          <p className="text-sm">No parts flagged for sourcing.</p>
          <p className="text-xs mt-1">Toggle the sourcing flag on parts in the Repair Tracker, or add parts manually.</p>
        </div>
      ) : (
        <>
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="w-10 px-3 py-2.5"></th>
                  <th className="w-[28%] px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Part</th>
                  <th className="w-[25%] px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">Part #</th>
                  <th className="w-[12%] sm:w-[8%] px-3 py-2.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Qty</th>
                  <th className="w-[14%] sm:w-[10%] px-3 py-2.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="w-[29%] px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Source</th>
                  <th className="w-10 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                {pagedItems.map((item) => {
                  const key = `${item.repair_id}-${item.tool_index}-${item.part_index}`;
                  const isSelected = selected.has(key);
                  return (
                    <tr
                      key={key}
                      onClick={() => onToggle(key, item)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggle(key, item)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-primary w-4 h-4"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-slate-900 dark:text-white">{item.part.name}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                        {item.part.part_number || <span className="text-slate-400 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.part.quantity ?? ''}
                          onChange={(e) => { e.stopPropagation(); const n = parseInt(e.target.value, 10); onUpdateQuantity(items.indexOf(item), e.target.value === '' || Number.isNaN(n) ? '' : n); }}
                          onBlur={(e) => { const n = parseInt(e.target.value, 10); if (Number.isNaN(n) || n < 1) onUpdateQuantity(items.indexOf(item), 1); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-12 sm:w-14 px-1 sm:px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {item.part.sourcing_emailed
                          ? (
                            <span className="inline-flex items-center gap-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                              <span className="material-symbols-outlined text-xs">mark_email_read</span>
                              <span className="hidden sm:inline">Emailed</span>
                            </span>
                          )
                          : (
                            <span className="inline-flex items-center gap-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                              <span className="material-symbols-outlined text-xs">schedule</span>
                              <span className="hidden sm:inline">Pending</span>
                            </span>
                          )
                        }
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <span className="text-primary text-xs font-mono">{item.request_number}</span>
                        <span className="text-slate-400 dark:text-slate-500 text-xs ml-2">{item.tool_brand || item.tool_type}{item.tool_model ? ` · ${item.tool_model}` : ''}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemove(item); }}
                          className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          title="Remove from queue"
                        >
                          <span className="material-symbols-outlined text-base">close</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {manualParts.map((part, idx) => {
                  const manualKey = `manual-${idx}`;
                  const isManualSelected = selected.has(manualKey);
                  const isValid = part.name.trim() && part.part_number?.trim();
                  return (
                  <tr
                    key={manualKey}
                    onClick={() => isValid && onToggle(manualKey, { manual: true, index: idx, part })}
                    className={`transition-colors ${isManualSelected ? 'bg-primary/10' : 'bg-orange-50/50 dark:bg-orange-900/5 hover:bg-orange-50 dark:hover:bg-orange-900/10'} ${isValid ? 'cursor-pointer' : ''}`}
                  >
                    <td className="px-3 py-2.5 text-center">
                      {isValid ? (
                        <input
                          type="checkbox"
                          checked={isManualSelected}
                          onChange={() => onToggle(manualKey, { manual: true, index: idx, part })}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-primary w-4 h-4"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-base text-orange-400">edit_note</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        placeholder="Part name *"
                        value={part.name}
                        autoComplete="off"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { const pos = e.target.selectionStart; updateManualRow(idx, 'name', e.target.value.toUpperCase()); triggerSuggest(idx, 'name', e.target.value, e.target); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                        onFocus={(e) => triggerSuggest(idx, 'name', e.target.value, e.target)}
                        onKeyDown={(e) => handleSuggestKeyDown(e, idx)}
                        onBlur={() => { touch(idx, 'name'); setTimeout(() => setSuggest((s) => (s.idx === idx && s.anchor === 'name' ? EMPTY_SUGGEST : s)), 150); }}
                        className={`w-full bg-white dark:bg-slate-800/80 border rounded-md px-2 py-1 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary focus:outline-none uppercase ${isTouched(idx, 'name') && !part.name.trim() ? 'border-red-400 dark:border-red-500' : 'border-slate-300 dark:border-slate-700'}`}
                      />
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      <input
                        type="text"
                        placeholder="Part # *"
                        value={part.part_number}
                        autoComplete="off"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { const pos = e.target.selectionStart; updateManualRow(idx, 'part_number', e.target.value.toUpperCase()); triggerSuggest(idx, 'partnum', e.target.value, e.target); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                        onFocus={(e) => triggerSuggest(idx, 'partnum', e.target.value, e.target)}
                        onKeyDown={(e) => handleSuggestKeyDown(e, idx)}
                        onBlur={() => { touch(idx, 'part_number'); setTimeout(() => setSuggest((s) => (s.idx === idx && s.anchor === 'partnum' ? EMPTY_SUGGEST : s)), 150); }}
                        className={`w-full bg-white dark:bg-slate-800/80 border rounded-md px-2 py-1 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary focus:outline-none uppercase ${isTouched(idx, 'part_number') && !part.part_number?.trim() ? 'border-red-400 dark:border-red-500' : 'border-slate-300 dark:border-slate-700'}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min="1"
                        value={part.quantity}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { const n = parseInt(e.target.value, 10); updateManualRow(idx, 'quantity', e.target.value === '' || Number.isNaN(n) ? '' : n); }}
                        onBlur={(e) => { const n = parseInt(e.target.value, 10); if (Number.isNaN(n) || n < 1) updateManualRow(idx, 'quantity', 1); }}
                        className="w-full bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 text-sm text-slate-900 dark:text-white text-center focus:border-primary focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {part.library_part_id ? (
                        <span className="inline-flex items-center gap-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold px-1.5 py-0.5 rounded-full" title="Matched to a parts library part">
                          <span className="material-symbols-outlined text-xs">inventory_2</span>
                          Library
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                          <span className="material-symbols-outlined text-xs">edit_note</span>
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); removeManualRow(idx, part); }}
                        className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title="Remove manual part"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Library suggestions for the manual row being typed in */}
          {suggest.idx !== null && suggest.rect && (suggest.loading || suggest.results.length > 0) && (() => {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const width = Math.min(Math.max(suggest.rect.width, 320), vw - 16);
            const left = Math.max(8, Math.min(suggest.rect.left, vw - width - 8));
            const spaceBelow = vh - suggest.rect.bottom;
            const openUp = spaceBelow < 180 && suggest.rect.top > spaceBelow;
            const style = openUp
              ? { position: 'fixed', left, width, bottom: vh - suggest.rect.top + 4, maxHeight: Math.min(240, suggest.rect.top - 12), zIndex: 60 }
              : { position: 'fixed', left, width, top: suggest.rect.bottom + 4, maxHeight: Math.min(240, spaceBelow - 12), zIndex: 60 };
            return (
              <div
                ref={dropdownRef}
                style={style}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl overflow-y-auto"
              >
                {suggest.loading && suggest.results.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-400">
                    <span className="material-symbols-outlined text-sm animate-spin">autorenew</span>
                    Searching parts library…
                  </div>
                ) : suggest.results.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    ref={(el) => { if (i === suggest.highlight) el?.scrollIntoView({ block: 'nearest' }); }}
                    onMouseDown={(e) => { e.preventDefault(); applySuggestion(suggest.idx, s); }}
                    onMouseEnter={() => setSuggest((prev) => ({ ...prev, highlight: i }))}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 border-b last:border-b-0 border-slate-100 dark:border-slate-700/60 transition-colors ${i === suggest.highlight ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{`${s.name}${s.part_number ? ` - ${s.part_number}` : ''}`.toUpperCase()}</span>
                      {s.model_names?.length > 0 && (
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate hidden sm:inline max-w-[180px]">{s.model_names.join(', ').toUpperCase()}</span>
                      )}
                      <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                        {s.suggested_price != null && (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">${s.suggested_price.toFixed(2)}</span>
                        )}
                        <span
                          title={s.quantity_on_hand > 0 ? (s.low_stock ? `Low stock (${s.quantity_on_hand})` : `${s.quantity_on_hand} in stock`) : 'Out of stock'}
                          className={
                            s.quantity_on_hand > 0
                              ? s.low_stock ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500 dark:text-emerald-400'
                              : 'text-red-500 dark:text-red-400'
                          }
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>inventory_2</span>
                        </span>
                        {s.compatibility_group_names?.length > 0 && (
                          <span title={s.compatibility_group_names.join(', ')} className="text-green-500 dark:text-green-400">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>sync_alt</span>
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            );
          })()}

          {items.length > 0 && (
            <PaginationBar
              currentPage={page}
              totalItems={items.length}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          )}
        </>
      )}
    </div>
  );
}
