import { useState, useEffect } from 'react';
import PaginationBar from '../../shared/PaginationBar';

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
    onManualPartsChange(manualParts.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const removeManualRow = (idx, part) => {
    onRemove({ manual: true, index: idx, part });
  };

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
                          onChange={(e) => { e.stopPropagation(); onUpdateQuantity(items.indexOf(item), e.target.value === '' ? '' : parseInt(e.target.value)); }}
                          onBlur={(e) => { if (!e.target.value || parseInt(e.target.value) < 1) onUpdateQuantity(items.indexOf(item), 1); }}
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
                        onChange={(e) => updateManualRow(idx, 'name', e.target.value.toUpperCase())}
                        onBlur={() => touch(idx, 'name')}
                        className={`w-full bg-white dark:bg-slate-800/80 border rounded-md px-2 py-1 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary focus:outline-none uppercase ${isTouched(idx, 'name') && !part.name.trim() ? 'border-red-400 dark:border-red-500' : 'border-slate-300 dark:border-slate-700'}`}
                      />
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      <input
                        type="text"
                        placeholder="Part # *"
                        value={part.part_number}
                        onChange={(e) => updateManualRow(idx, 'part_number', e.target.value.toUpperCase())}
                        onBlur={() => touch(idx, 'part_number')}
                        className={`w-full bg-white dark:bg-slate-800/80 border rounded-md px-2 py-1 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary focus:outline-none uppercase ${isTouched(idx, 'part_number') && !part.part_number?.trim() ? 'border-red-400 dark:border-red-500' : 'border-slate-300 dark:border-slate-700'}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min="1"
                        value={part.quantity}
                        onChange={(e) => updateManualRow(idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 text-sm text-slate-900 dark:text-white text-center focus:border-primary focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center gap-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-xs">edit_note</span>
                        Manual
                      </span>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => removeManualRow(idx, part)}
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
