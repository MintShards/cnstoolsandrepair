import useEscapeClose from '../../utils/useEscapeClose';

/**
 * The one confirm dialog for the sales area. Defaults cover the common
 * destructive case; pass confirmLabel/confirmClass for anything else
 * (e.g. Deactivate/Activate on the reps tab).
 */
export default function ConfirmModal({
  message,
  confirmLabel = 'Delete',
  confirmClass = 'bg-red-600 hover:bg-red-700',
  onConfirm,
  onCancel,
}) {
  useEscapeClose(onCancel);
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-sm">
        <div className="p-6">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 text-white font-black rounded-xl transition-colors text-sm uppercase ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
