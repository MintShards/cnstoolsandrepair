import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Toast system shared by the Repair Tracker and the Shop Hub. Extracted from
// RepairTracker.jsx; that page re-exports ToastContext/useToast so the
// existing `import { useToast } from '.../RepairTracker'` sites keep working.
export const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

function Toast({ toast, onDismiss }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const duration = 4000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const isSuccess = toast.type === 'success';
  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border shadow-2xl text-sm font-medium max-w-sm overflow-hidden
        animate-[slideInRight_0.3s_ease-out]
        ${isSuccess
          ? 'bg-white dark:bg-slate-800 border-green-300 dark:border-green-600/50'
          : 'bg-white dark:bg-slate-800 border-red-300 dark:border-red-600/50'
        }`}
    >
      <div className={`flex-shrink-0 w-1 self-stretch ${isSuccess ? 'bg-green-500' : 'bg-red-500'}`} />
      <div className="flex items-start gap-3 py-3 pr-3 flex-1 min-w-0">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isSuccess ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'
        }`}>
          <span className="material-symbols-outlined text-base">
            {isSuccess ? 'check_circle' : 'error'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm ${isSuccess ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
            {isSuccess ? 'Success' : 'Error'}
          </p>
          <p className="text-slate-600 dark:text-slate-300 text-xs mt-0.5 leading-relaxed">{toast.text}</p>
          {/* Progress bar */}
          <div className="mt-2 h-0.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ease-linear ${isSuccess ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0 mt-0.5"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-3 sm:bottom-6 right-3 sm:right-6 z-[80] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-1.5rem)] sm:max-w-sm">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((type, text) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
