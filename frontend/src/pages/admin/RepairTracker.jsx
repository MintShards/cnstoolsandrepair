import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CustomersTab from '../../components/admin/tabs/CustomersTab';
import RepairRequestsTab from '../../components/admin/tabs/RepairRequestsTab';
import RepairJobsTab from '../../components/admin/tabs/RepairJobsTab';
import DashboardSummary from '../../components/admin/DashboardSummary';
import ThemeToggle from '../../components/layout/ThemeToggle';

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

export default function RepairTracker() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [preselectedCustomer, setPreselectedCustomer] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [tabCounts, setTabCounts] = useState({ customers: null, requests: null, jobs: null });
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState('');
  const [dashboardTechFilter, setDashboardTechFilter] = useState('');
  const [dashboardOpenNewJob, setDashboardOpenNewJob] = useState(false);
  const [dashboardOpenNewCustomer, setDashboardOpenNewCustomer] = useState(false);
  const [jobsNeedAttention, setJobsNeedAttention] = useState(false);
  const [staleDays, setStaleDays] = useState(3);
  const [dashboardOpenJobId, setDashboardOpenJobId] = useState(null);

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
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'jobs', label: 'Repair Jobs', icon: 'build_circle' },
    { id: 'requests', label: 'Repair Requests', icon: 'inbox' },
    { id: 'customers', label: 'Customers', icon: 'group' },
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

  const handleDashboardStatusFilter = useCallback((status) => {
    setDashboardStatusFilter(status);
    setActiveTab('jobs');
  }, []);

  const handleDashboardTechFilter = useCallback((tech) => {
    setDashboardTechFilter(tech);
    setActiveTab('jobs');
  }, []);

  const handleDashboardNewJob = useCallback(() => {
    setDashboardOpenNewJob(true);
    setActiveTab('jobs');
  }, []);

  const handleDashboardNewCustomer = useCallback(() => {
    setDashboardOpenNewCustomer(true);
    setActiveTab('customers');
  }, []);

  const handleGoToRequests = useCallback(() => {
    setActiveTab('requests');
  }, []);

  const handleDashboardOpenJob = useCallback((jobId) => {
    setDashboardOpenJobId(jobId);
    setActiveTab('jobs');
  }, []);

  const handleAttentionUpdate = useCallback((hasAttention) => {
    setJobsNeedAttention(hasAttention);
  }, []);

  const handleStaleDaysUpdate = useCallback((days) => {
    setStaleDays(days);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col">
        {/* Repair Tracker Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-lg shadow-black/10 dark:shadow-black/30">
          <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-2">
              {/* Left: brand + title */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Link to="/" className="font-logo text-base sm:text-xl font-bold leading-none tracking-wide uppercase flex-shrink-0">
                  <span className="text-accent-orange">CNS</span>{' '}
                  <span className="text-slate-900 dark:text-white hidden sm:inline">Tool Repair</span>
                </Link>
                <div className="h-7 sm:h-8 w-px bg-slate-300 dark:bg-slate-700/80 flex-shrink-0"></div>
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight truncate">
                    Repair Tracker
                  </h1>
                  <p className="text-xs text-slate-500 hidden sm:block leading-tight">Work Orders &amp; Customer Repairs</p>
                </div>
              </div>
              {/* Right: actions */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <ThemeToggle />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800/30 hover:border-red-300 dark:hover:border-red-700/50 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 rounded-xl transition-all text-sm font-bold"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  <span className="hidden sm:inline">Logout</span>
                </button>
                <Link
                  to="/"
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all text-sm font-bold"
                >
                  <span className="material-symbols-outlined text-base">arrow_back</span>
                  <span className="hidden sm:inline">Back to Website</span>
                </Link>
              </div>
            </div>
          </div>
          {/* Subtle gradient accent line */}
          <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8 w-full">

          {/* Tab Navigation */}
          <div className="mb-6 overflow-x-auto -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6">
            <nav className="flex gap-1.5 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-1.5 w-fit shadow-lg shadow-black/5 dark:shadow-black/20">
              {tabs.map((tab) => {
                const count = tabCounts[tab.id];
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-primary text-white shadow-md shadow-primary/25'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">{tab.icon}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                    {count !== null && count > 0 && (
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full min-w-[22px] text-center leading-none ${
                        activeTab === tab.id
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {count}
                      </span>
                    )}
                    {tab.id === 'jobs' && jobsNeedAttention && activeTab !== 'jobs' && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" title="Jobs need attention" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-6 shadow-xl shadow-black/5 dark:shadow-black/20 animate-fadeInScale">
            {activeTab === 'dashboard' && (
              <DashboardSummary
                onStatusFilter={handleDashboardStatusFilter}
                onTechFilter={handleDashboardTechFilter}
                onNewJob={handleDashboardNewJob}
                onNewCustomer={handleDashboardNewCustomer}
                onGoToRequests={handleGoToRequests}
                onAttentionUpdate={handleAttentionUpdate}
                onStaleDaysUpdate={handleStaleDaysUpdate}
                onOpenJob={handleDashboardOpenJob}
                asTab
              />
            )}
            {activeTab === 'customers' && (
              <CustomersTab
                onNewJob={handleNewJobFromCustomer}
                onCountUpdate={handleCustomersCountUpdate}
                externalOpenNewCustomer={dashboardOpenNewCustomer}
                onExternalOpenNewCustomerHandled={() => setDashboardOpenNewCustomer(false)}
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
                externalStatusFilter={dashboardStatusFilter}
                onExternalStatusFilterApplied={() => setDashboardStatusFilter('')}
                externalTechFilter={dashboardTechFilter}
                onExternalTechFilterApplied={() => setDashboardTechFilter('')}
                externalOpenNewJob={dashboardOpenNewJob}
                onExternalOpenNewJobHandled={() => setDashboardOpenNewJob(false)}
                externalOpenJobId={dashboardOpenJobId}
                onExternalOpenJobHandled={() => setDashboardOpenJobId(null)}
                staleDays={staleDays}
              />
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white/50 dark:bg-slate-900/50 border-t border-slate-200/50 dark:border-slate-800/50 mt-auto">
          <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-3">
            <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-600">
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
