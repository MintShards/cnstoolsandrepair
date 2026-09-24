import { useState } from 'react';
import { formatMoney } from '../../../utils/money';
import ConfirmModal from '../../sales/ConfirmModal';

/**
 * A tool's extra charges under its parts list — what the customer pays for
 * this tool beyond labour and parts. Add opens the extra-charge form on this
 * tool; remove is a tool update (the tool form edits them in place).
 */
export default function ToolExtraCharges({ tool, onAdd, onRemove }) {
  const [confirm, setConfirm] = useState(null); // { index, description, amount }
  const charges = tool.extra_charges || [];
  return (
    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/40">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-slate-500 uppercase tracking-wide font-bold" style={{ fontSize: '12px' }}>
          Extra charges{charges.length > 0 && ` (${charges.length})`}
        </span>
        <button
          type="button"
          onClick={onAdd}
          title="Add an extra charge to this tool"
          className="inline-flex items-center gap-1 flex-shrink-0 whitespace-nowrap px-2 py-1 -my-1 min-h-[44px] sm:min-h-0 rounded-lg text-xs font-bold text-primary dark:text-blue-400 hover:bg-primary/10 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          {/* The heading beside it needs the room on a phone. */}
          <span className="sm:hidden">Add</span>
          <span className="hidden sm:inline">Add charge</span>
        </button>
      </div>
      {charges.length === 0 ? (
        <p className="mt-1 text-slate-400 dark:text-slate-600 italic">No extra charges</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {charges.map((c, i) => (
            <li key={i} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 rounded-md px-2.5 py-1.5 border border-slate-200/30 dark:border-slate-700/30">
              <span className="flex-1 min-w-0 truncate text-slate-700 dark:text-slate-200 font-medium">{c.description}</span>
              <span className="text-xs font-bold tabular-nums whitespace-nowrap text-slate-900 dark:text-white">{formatMoney(c.amount)}</span>
              <button
                type="button"
                onClick={() => setConfirm({ index: i, description: c.description, amount: c.amount })}
                aria-label={`Remove ${c.description}`}
                title="Remove this charge"
                className="w-8 h-8 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 -my-1 -mr-1 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {confirm && (
        <ConfirmModal
          message={`Remove “${confirm.description}” (${formatMoney(confirm.amount)})? The customer is no longer charged for it.`}
          confirmLabel="Remove"
          onConfirm={() => { onRemove(tool.tool_id, confirm.index); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
