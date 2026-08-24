import { useEffect, useRef, useState } from 'react';
import { repairsAPI } from '../../services/api';
import { INPUT_CLS, LABEL_CLS } from './formStyles';

/**
 * Debounced work-order search for linking a task or feed message to a job.
 * Emits {repair_id, request_number} through onChange; null clears the link.
 */
export default function WorkOrderPicker({ value, onChange, label = 'Link a Work Order' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return undefined;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const { jobs } = await repairsAPI.list({ search: query.trim(), skip: 0, limit: 10 });
        setResults(jobs);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query]);

  // Close the dropdown on outside click
  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  if (value) {
    return (
      <div>
        <label className={LABEL_CLS}>{label}</label>
        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-primary/5 border border-primary/30 rounded-xl">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-primary dark:text-blue-400 min-w-0">
            <span className="material-symbols-outlined text-base">build_circle</span>
            <span className="truncate">{value.request_number}</span>
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Remove work order link"
            className="w-9 h-9 -my-1.5 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <label className={LABEL_CLS}>{label}</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true); }}
          placeholder="Search WO number, company, or name..."
          className={INPUT_CLS}
        />
        {searching && (
          <span className="material-symbols-outlined animate-spin text-base text-slate-400 absolute right-3 top-1/2 -translate-y-1/2">
            progress_activity
          </span>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl divide-y divide-slate-100 dark:divide-slate-700/60">
          {results.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                onClick={() => {
                  onChange({ repair_id: job.id, request_number: job.request_number });
                  setQuery('');
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <span className="block text-sm font-bold text-slate-900 dark:text-white">{job.request_number}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                  {job.company_name || `${job.first_name || ''} ${job.last_name || ''}`.trim() || '—'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
