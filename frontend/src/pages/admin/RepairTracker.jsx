import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CustomersTab from '../../components/admin/tabs/CustomersTab';
import RepairRequestsTab from '../../components/admin/tabs/RepairRequestsTab';
import RepairJobsTab from '../../components/admin/tabs/RepairJobsTab';

// ── TOAST SYSTEM ─────────────────────────────────────────────
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
          ? 'bg-slate-800 border-green-600/50'
          : 'bg-slate-800 border-red-600/50'
        }`}
    >
      <div className={`flex-shrink-0 w-1 self-stretch ${isSuccess ? 'bg-green-500' : 'bg-red-500'}`} />
      <div className="flex items-start gap-3 py-3 pr-3 flex-1 min-w-0">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isSuccess ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          <span className="material-symbols-outlined text-base">
            {isSuccess ? 'check_circle' : 'error'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm ${isSuccess ? 'text-green-300' : 'text-red-300'}`}>
            {isSuccess ? 'Success' : 'Error'}
          </p>
          <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">{toast.text}</p>
          {/* Progress bar */}
          <div className="mt-2 h-0.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ease-linear ${isSuccess ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 mt-0.5"
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
    <div className="fixed bottom-6 right-6 z-[80] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export default function RepairTracker() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('customers');
  const [preselectedCustomer, setPreselectedCustomer] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [tabCounts, setTabCounts] = useState({ customers: null, requests: null, jobs: null });

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_login_time');
    navigate('/admin/login');
  };

  const showToast = useCallback((type, text) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const tabs = [
    { id: 'customers', label: 'Customers', icon: 'group' },
    { id: 'requests', label: 'Repair Requests', icon: 'inbox' },
    { id: 'jobs', label: 'Repair Jobs', icon: 'build_circle' },
  ];

  const handleCountUpdate = useCallback((tab, count) => {
    setTabCounts(prev => ({ ...prev, [tab]: count }));
  }, []);

  const handleCustomersCountUpdate = useCallback((n) => handleCountUpdate('customers', n), [handleCountUpdate]);
  const handleRequestsCountUpdate = useCallback((n) => handleCountUpdate('requests', n), [handleCountUpdate]);
  const handleJobsCountUpdate = useCallback((n) => handleCountUpdate('jobs', n), [handleCountUpdate]);

  const handleNewJobFromCustomer = (customer) => {
    setPreselectedCustomer(customer);
    setActiveTab('jobs');
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId !== 'jobs') {
      setPreselectedCustomer(null);
    }
  };

  return (
    <ToastContext.Provider value={showToast}>
      <div className="min-h-screen bg-slate-950 flex flex-col">
        {/* Repair Tracker Header */}
        <header className="bg-slate-900 border-b border-slate-800 shadow-lg shadow-black/30">
          <div className="max-w-screen-2xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link to="/" className="font-logo text-xl font-bold leading-none tracking-wide uppercase">
                  <span className="text-accent-orange">CNS</span>{' '}
                  <span className="text-white">Tool Repair</span>
                </Link>
                <div className="h-8 w-px bg-slate-700/80"></div>
                <div>
                  <h1 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">build_circle</span>
                    Repair Tracker
                  </h1>
                  <p className="text-xs text-slate-500">Work Orders &amp; Customer Repairs</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-red-900/20 hover:bg-red-900/40 border border-red-800/30 hover:border-red-700/50 text-red-400 hover:text-red-300 rounded-xl transition-all text-sm font-bold"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  Logout
                </button>
                <Link
                  to="/"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white rounded-xl transition-all text-sm font-bold"
                >
                  <span className="material-symbols-outlined text-base">arrow_back</span>
                  Back to Website
                </Link>
              </div>
            </div>
          </div>
          {/* Subtle gradient accent line */}
          <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-screen-2xl mx-auto px-6 py-8 w-full">
          {/* Tab Navigation */}
          <div className="mb-6">
            <nav className="flex gap-1.5 bg-slate-900/80 rounded-2xl border border-slate-800 p-1.5 w-fit shadow-lg shadow-black/20">
              {tabs.map((tab) => {
                const count = tabCounts[tab.id];
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-primary text-white shadow-md shadow-primary/25'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">{tab.icon}</span>
                    <span>{tab.label}</span>
                    {count !== null && count > 0 && (
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full min-w-[22px] text-center leading-none ${
                        activeTab === tab.id
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 shadow-xl shadow-black/20 animate-fadeInScale">
            {activeTab === 'customers' && (
              <CustomersTab
                onNewJob={handleNewJobFromCustomer}
                onCountUpdate={handleCustomersCountUpdate}
              />
            )}
            {activeTab === 'requests' && (
              <RepairRequestsTab
                onConvertSuccess={() => handleTabChange('jobs')}
                onCountUpdate={handleRequestsCountUpdate}
              />
            )}
            {activeTab === 'jobs' && (
              <RepairJobsTab
                preselectedCustomer={preselectedCustomer}
                onPreselectedCustomerUsed={() => setPreselectedCustomer(null)}
                onCountUpdate={handleJobsCountUpdate}
              />
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-slate-900/50 border-t border-slate-800/50 mt-auto">
          <div className="max-w-screen-2xl mx-auto px-6 py-3">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <p className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">build</span>
                Internal tool — not customer facing
              </p>
              <p>CNS Tool Repair © {new Date().getFullYear()}</p>
            </div>
          </div>
        </footer>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
