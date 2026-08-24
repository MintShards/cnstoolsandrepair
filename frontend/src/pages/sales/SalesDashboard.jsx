import { useState, useCallback, useEffect, createContext, useContext, lazy, Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../../services/api';
import ThemeToggle from '../../components/layout/ThemeToggle';

const TodayRouteTab = lazy(() => import('../../components/sales/tabs/TodayRouteTab'));
const BusinessesTab = lazy(() => import('../../components/sales/tabs/BusinessesTab'));
const FollowUpsTab = lazy(() => import('../../components/sales/tabs/FollowUpsTab'));
const ZonesTab = lazy(() => import('../../components/sales/tabs/ZonesTab'));
// Static, not lazy: this page is already lazy at the router, and ZonesTab
// imports it statically — a second lazy copy just double-chunks it.
import SavedRoutesSection from '../../components/sales/SavedRoutesSection';

// 'route' is the merged Routes tab: today's runner on top, the full planner
// below. An old '?tab=routes' (or '?tab=sales-reps') link falls outside these
// ids and lands there too. Inside Zones, admin-only actions (zone/business
// CRUD) stay hidden for reps. Sales-rep ACCOUNT management lives in Admin
// Settings → Users & Accounts, not here.
const TAB_IDS = ['route', 'businesses', 'follow-ups', 'zones'];

// One collapsed line per secondary section — the runner IS the tab; the
// library and the history expand only when needed.
function SectionBar({ icon, label, open, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
    >
      <span className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
        <span className="material-symbols-outlined text-base">{icon}</span>
        {label}
      </span>
      <span className="material-symbols-outlined text-slate-400">
        {open ? 'expand_less' : 'expand_more'}
      </span>
    </button>
  );
}

// The merged Routes tab: today's runner front and centre; the Saved Routes
// library lives behind a collapsed bar and stays closed until tapped. Run
// History lives with the zones, where the routes themselves do.
function RoutesHub({ currentUser, onTabSwitch }) {
  const [todaySignal, setTodaySignal] = useState(0);
  const [savedSignal, setSavedSignal] = useState(0);
  const [savedOpen, setSavedOpen] = useState(false);

  return (
    <>
      <TodayRouteTab
        currentUser={currentUser}
        onTabSwitch={onTabSwitch}
        refreshSignal={todaySignal}
        onMutate={() => setSavedSignal((v) => v + 1)}
      />

      <div className="mt-8">
        <SectionBar
          icon="route"
          label="Saved Routes"
          open={savedOpen}
          onToggle={() => setSavedOpen((v) => !v)}
        />
        {savedOpen && (
          <div className="mt-3">
            {/* Starting a saved route creates a run — the runner above needs
                to hear about it. Completing stops up there moves sweep counts
                down here, so the signals run both ways. */}
            <SavedRoutesSection
              onChanged={() => setTodaySignal((v) => v + 1)}
              refreshSignal={savedSignal}
            />
          </div>
        )}
      </div>
    </>
  );
}

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

export default function SalesDashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    document.title = 'Sales Dashboard | CNS Tool Repair';
    let cancelled = false;
    authAPI.getMe()
      .then((user) => { if (!cancelled) setCurrentUser(user); })
      .catch(() => {
        // A 401 is already handled by the axios interceptor; anything else means
        // we can't tell admin from rep, so surface it instead of silently
        // rendering the reduced sales UI.
        if (!cancelled) console.error('Could not load the signed-in user.');
      })
      .finally(() => { if (!cancelled) setUserLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const isAdmin = currentUser?.role === 'admin';
  const tabParam = searchParams.get('tab');
  const activeTab = TAB_IDS.includes(tabParam) ? tabParam : 'route';

  const [toasts, setToasts] = useState([]);

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch { /* ignore */ }
    navigate('/sales/login');
  };

  const showToast = useCallback((type, text) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const goToTab = useCallback((tabId) => {
    setSearchParams(tabId === 'route' ? {} : { tab: tabId });
  }, [setSearchParams]);

  const tabs = [
    { id: 'route',      label: 'Routes',         shortLabel: 'Routes',     icon: 'route' },
    { id: 'businesses', label: 'Businesses',     shortLabel: 'Prospects',  icon: 'storefront' },
    { id: 'follow-ups', label: 'Follow-ups',     shortLabel: 'Follow-ups', icon: 'event_upcoming' },
    { id: 'zones',      label: 'Zones',          shortLabel: 'Zones',      icon: 'map' },
  ];

  return (
    <ToastContext.Provider value={showToast}>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-lg shadow-black/10 dark:shadow-black/30">
          <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-2">
              {/* Left: brand + title */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Full brand only at desktop — below that the page title is
                    the thing that must never crush into "ROUTE M…". */}
                <Link to="/" className="font-logo text-base sm:text-xl font-bold leading-none tracking-wide uppercase flex-shrink-0">
                  <span className="text-accent-orange">CNS</span>{' '}
                  <span className="text-slate-900 dark:text-white hidden lg:inline">Tool Repair</span>
                </Link>
                <div className="h-7 sm:h-8 w-px bg-slate-300 dark:bg-slate-700/80 flex-shrink-0"></div>
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight truncate">
                    Route Management
                  </h1>
                  <p className="text-xs text-slate-500 hidden sm:block leading-tight">
                    {currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.email : 'Sales Dashboard'}
                  </p>
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
                  <span className="hidden lg:inline">Logout</span>
                </button>
                {isAdmin && (
                  <Link
                    to="/admin/repair-tracker"
                    className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all text-sm font-bold"
                  >
                    <span className="material-symbols-outlined text-base">build_circle</span>
                    <span className="hidden lg:inline">Repair Tracker</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8 w-full">

          {/* Tab Navigation */}
          <div className="mb-6">
            <nav className="flex gap-1.5 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-1.5 w-full shadow-lg shadow-black/5 dark:shadow-black/20">
              {tabs.map((tab) => (
                <Link
                  key={tab.id}
                  to={tab.id === 'route' ? '/sales/dashboard' : `/sales/dashboard?tab=${tab.id}`}
                  className={`flex-1 min-w-0 flex flex-col lg:flex-row items-center justify-center gap-0.5 lg:gap-2 px-1 lg:px-5 py-2 lg:py-2.5 rounded-xl font-bold transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-primary text-white shadow-md shadow-primary/25'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{tab.icon}</span>
                  {/* Stacked icon-over-label through tablet — five row-layout
                      tabs under ~1024px shear labels into "Busines…". */}
                  <span className="lg:hidden text-[10px] sm:text-xs leading-tight truncate max-w-full">{tab.shortLabel}</span>
                  <span className="hidden lg:block min-w-0 truncate text-sm leading-tight">{tab.label}</span>
                </Link>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-6 shadow-xl shadow-black/5 dark:shadow-black/20 animate-fadeInScale">
            <Suspense fallback={<TabLoading />}>
              {!userLoaded && <TabLoading />}
              {userLoaded && activeTab === 'route' && (
                <RoutesHub currentUser={currentUser} onTabSwitch={goToTab} />
              )}
              {userLoaded && activeTab === 'businesses' && (
                <BusinessesTab currentUser={currentUser} initialZoneFilter={searchParams.get('zone') || ''} />
              )}
              {userLoaded && activeTab === 'follow-ups' && (
                <FollowUpsTab />
              )}
              {userLoaded && activeTab === 'zones' && (
                <ZonesTab currentUser={currentUser} />
              )}
            </Suspense>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white/50 dark:bg-slate-900/50 border-t border-slate-200/50 dark:border-slate-800/50 mt-auto">
          <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-3">
            <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-600">
              <p className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">route</span>
                Route Management — Sales Rep Tool
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
