import { useState, useCallback, useEffect, useMemo, createContext, useContext, lazy, Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { repairsAPI, customersAPI, quotesAPI, authAPI } from '../../services/api';
import DashboardSummary from '../../components/admin/DashboardSummary';
import ThemeToggle from '../../components/layout/ThemeToggle';

// Dashboard (the landing tab) stays in this chunk; every other tab loads on
// first visit so opening the tracker doesn't download the whole admin suite
const CustomersTab = lazy(() => import('../../components/admin/tabs/CustomersTab'));
const RepairRequestsTab = lazy(() => import('../../components/admin/tabs/RepairRequestsTab'));
const RepairJobsTab = lazy(() => import('../../components/admin/tabs/RepairJobsTab'));
const PartsLibraryTab = lazy(() => import('../../components/admin/tabs/PartsLibraryTab'));
const PartsSourcingTab = lazy(() => import('../../components/admin/tabs/PartsSourcingTab'));
const UserGuide = lazy(() => import('../../components/admin/UserGuide'));

// Section ids that may appear in the URL as /admin/repair-tracker?tab=<id>
const TAB_IDS = ['dashboard', 'jobs', 'customers', 'requests', 'parts-library', 'parts-sourcing'];

function TabLoading() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500">
      <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
    </div>
  );
}

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

  // Public pages set their titles via Helmet; the tracker must not keep
  // whatever SEO title the visitor arrived with
  useEffect(() => {
    document.title = 'Repair Tracker | CNS Tool Repair';
  }, []);

  // Active tab lives in the URL (?tab=jobs) so each section is a real link:
  // right-click → open in new tab works, and back/forward moves between tabs
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = TAB_IDS.includes(tabParam) ? tabParam : 'dashboard';

  // Parts Library handoffs (low-stock filter, brand/model drill-down) are URL
  // params too, so tool links on work orders can open the library in a new tab
  const partsLibraryFilter = activeTab === 'parts-library' ? searchParams.get('filter') : null;
  const plBrand = activeTab === 'parts-library' ? searchParams.get('brand') : null;
  const plModel = activeTab === 'parts-library' ? searchParams.get('model') : null;
  const partsLibraryNav = useMemo(
    () => (plBrand ? { brandName: plBrand, modelName: plModel } : null),
    [plBrand, plModel]
  );
  const [preselectedCustomer, setPreselectedCustomer] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [tabCounts, setTabCounts] = useState({ customers: null, requests: null, jobs: null });
  const [dashboardOpenNewJob, setDashboardOpenNewJob] = useState(false);
  const [dashboardOpenNewCustomer, setDashboardOpenNewCustomer] = useState(false);
  const [jobsNeedAttention, setJobsNeedAttention] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const handleLogout = async () => {
    // Clear the httpOnly auth cookie server-side, then redirect.
    try {
      await authAPI.logout();
    } catch (e) {
      // Ignore network/logout errors — redirect regardless.
    }
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
    { id: 'dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: 'dashboard' },
    { id: 'jobs', label: 'Repair Jobs', shortLabel: 'Jobs', icon: 'build_circle' },
    { id: 'customers', label: 'Customers', shortLabel: 'Customers', icon: 'group' },
    { id: 'requests', label: 'Repair Requests', shortLabel: 'Requests', icon: 'inbox' },
    { id: 'parts-library', label: 'Parts Library', shortLabel: 'Parts', icon: 'inventory_2' },
    { id: 'parts-sourcing', label: 'Parts Sourcing', shortLabel: 'Sourcing', icon: 'local_shipping' },
  ];

  const handleCountUpdate = useCallback((tab, count) => {
    setTabCounts(prev => ({ ...prev, [tab]: count }));
  }, []);

  const handleCustomersCountUpdate = useCallback((n) => handleCountUpdate('customers', n), [handleCountUpdate]);
  const handleRequestsCountUpdate = useCallback((n) => handleCountUpdate('requests', n), [handleCountUpdate]);
  const handleJobsCountUpdate = useCallback((n) => handleCountUpdate('jobs', n), [handleCountUpdate]);

  // Fetch all tab counts independently of which tab is active.
  // This prevents badges from blinking (null → number) when tabs mount/unmount,
  // and ensures counts always reflect unfiltered totals.
  const fetchTabCounts = useCallback(async () => {
    try {
      const [jobsResult, customers, quotes] = await Promise.all([
        repairsAPI.list({ skip: 0, limit: 1 }),
        customersAPI.list({ limit: 200 }),
        quotesAPI.list({}),
      ]);
      setTabCounts({
        jobs: jobsResult.total,
        customers: customers.length,
        requests: quotes.filter(q => q.status === 'pending').length,
      });
    } catch {
      // Silently fail — counts are non-critical
    }
  }, []);

  useEffect(() => {
    fetchTabCounts();
    const interval = setInterval(fetchTabCounts, 60000);
    return () => clearInterval(interval);
  }, [fetchTabCounts]);

  const goToTab = useCallback((tabId) => {
    setSearchParams(tabId === 'dashboard' ? {} : { tab: tabId });
  }, [setSearchParams]);

  // Clear cross-tab handoff state when leaving the tab it targets. Runs on
  // every tab change, including browser back/forward and direct URL entry.
  // (Parts Library handoffs need no clearing — switching tabs drops their
  // URL params since tab links and goToTab only carry ?tab=.)
  useEffect(() => {
    if (activeTab !== 'jobs') {
      setPreselectedCustomer(null);
    }
  }, [activeTab]);

  const handleNewJobFromCustomer = (customer) => {
    setPreselectedCustomer(customer);
    goToTab('jobs');
  };

  const handleDashboardNewJob = useCallback(() => {
    setDashboardOpenNewJob(true);
    goToTab('jobs');
  }, [goToTab]);

  const handleDashboardNewCustomer = useCallback(() => {
    setDashboardOpenNewCustomer(true);
    goToTab('customers');
  }, [goToTab]);

  const handleAttentionUpdate = useCallback((hasAttention) => {
    setJobsNeedAttention(hasAttention);
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
          <div className="mb-6">
            <nav className="flex gap-1.5 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-1.5 w-full shadow-lg shadow-black/5 dark:shadow-black/20">
              {tabs.map((tab) => {
                const count = tabCounts[tab.id];
                return (
                  <Link
                    key={tab.id}
                    to={tab.id === 'dashboard' ? '/admin/repair-tracker' : `/admin/repair-tracker?tab=${tab.id}`}
                    className={`flex-1 min-w-0 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1 sm:px-3 lg:px-5 py-2 sm:py-2.5 rounded-xl font-bold transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-primary text-white shadow-md shadow-primary/25'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="relative flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl">{tab.icon}</span>
                      {count !== null && count > 0 && (
                        <span className={`sm:hidden absolute -top-1.5 -right-2.5 text-[10px] font-black px-1 py-0 rounded-full min-w-[16px] text-center leading-tight ${
                          activeTab === tab.id
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                          {count}
                        </span>
                      )}
                      {tab.id === 'jobs' && jobsNeedAttention && activeTab !== 'jobs' && (
                        <span className="sm:hidden absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      )}
                    </div>
                    <span className="sm:hidden text-[10px] leading-tight truncate max-w-full">{tab.shortLabel}</span>
                    <span className="hidden sm:block min-w-0 truncate text-sm leading-tight">{tab.label}</span>
                    {count !== null && count > 0 && (
                      <span className={`hidden sm:inline text-xs font-black px-2 py-0.5 rounded-full min-w-[22px] text-center leading-none ${
                        activeTab === tab.id
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {count}
                      </span>
                    )}
                    {tab.id === 'jobs' && jobsNeedAttention && activeTab !== 'jobs' && (
                      <span className="hidden sm:flex w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" title="Jobs need attention" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-6 shadow-xl shadow-black/5 dark:shadow-black/20 animate-fadeInScale">
            <Suspense fallback={<TabLoading />}>
            {activeTab === 'dashboard' && (
              <DashboardSummary
                onNewJob={handleDashboardNewJob}
                onNewCustomer={handleDashboardNewCustomer}
                onAttentionUpdate={handleAttentionUpdate}
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
                onConvertSuccess={() => goToTab('jobs')}
                onCountUpdate={handleRequestsCountUpdate}
              />
            )}
            {activeTab === 'parts-library' && (
              <PartsLibraryTab
                initialFilter={partsLibraryFilter}
                initialNav={partsLibraryNav}
                key={partsLibraryNav ? JSON.stringify(partsLibraryNav) : partsLibraryFilter}
              />
            )}
            {activeTab === 'parts-sourcing' && (
              <PartsSourcingTab />
            )}
            {activeTab === 'jobs' && (
              <RepairJobsTab
                preselectedCustomer={preselectedCustomer}
                onPreselectedCustomerUsed={() => setPreselectedCustomer(null)}
                onCountUpdate={handleJobsCountUpdate}
                externalOpenNewJob={dashboardOpenNewJob}
                onExternalOpenNewJobHandled={() => setDashboardOpenNewJob(false)}
              />
            )}
            </Suspense>
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
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowGuide(true)}
                  className="flex items-center gap-1.5 hover:text-slate-600 dark:hover:text-slate-400 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">menu_book</span>
                  User Guide
                </button>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <p>CNS Tool Repair © {new Date().getFullYear()}</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
      {showGuide && (
        <Suspense fallback={null}>
          <UserGuide onClose={() => setShowGuide(false)} />
        </Suspense>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
