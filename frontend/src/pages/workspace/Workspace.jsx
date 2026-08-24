import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI, tasksAPI, messagesAPI, staffAPI, repairsAPI } from '../../services/api';
import usePollWhileVisible from '../../utils/usePollWhileVisible';
import ThemeToggle from '../../components/layout/ThemeToggle';
import { ToastProvider } from '../../components/admin/shared/ToastProvider';
import WorkspaceSidebar from '../../components/workspace/WorkspaceSidebar';
import { WORKSPACE_SECTION_IDS } from '../../constants/workspace';

// Sections load on first visit so opening the hub doesn't download everything
const TasksSection = lazy(() => import('../../components/workspace/TasksSection'));
const TaskCalendar = lazy(() => import('../../components/workspace/TaskCalendar'));
const FeedSection = lazy(() => import('../../components/workspace/FeedSection'));
const ChangePasswordModal = lazy(() => import('../../components/workspace/ChangePasswordModal'));

function SectionLoading() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500">
      <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
    </div>
  );
}

/**
 * Workspace — the staff hub: shared to-dos (board/list/calendar), the
 * shop feed with customer-call logging, and staff account management.
 * Everything stays in sync through polling: a 60s counts loop here, faster
 * per-section polls, an immediate catch-up when the tab regains focus, and
 * refetches after every mutation. Polls skip ticks while the tab is hidden
 * (usePollWhileVisible) — the focus catch-up covers re-entry.
 */
export default function Workspace() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Workspace | CNS Tool Repair';
  }, []);

  // Active section lives in the URL (?section=feed) so each area is a real
  // link — open-in-new-tab and back/forward work, same as the tracker.
  const [searchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  const activeSection = WORKSPACE_SECTION_IDS.includes(sectionParam) ? sectionParam : 'my-tasks';

  const [currentUser, setCurrentUser] = useState(null);
  const [staff, setStaff] = useState([]);
  const [counts, setCounts] = useState({
    myOpen: null, myOverdue: 0, dueToday: null, allOpen: null, unread: null,
    attention: null, stuck: 0,
  });
  // Bumped when the browser tab regains focus; sections refetch on change.
  const [focusTick, setFocusTick] = useState(0);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const refreshCounts = useCallback(async () => {
    try {
      const [taskSummary, messageSummary, attention] = await Promise.all([
        tasksAPI.summary(),
        messagesAPI.summary(),
        // Counts only — the All Tasks panel fetches its own item lists.
        repairsAPI.attention().catch(() => null),
      ]);
      setCounts({
        myOpen: taskSummary.my_open,
        myOverdue: taskSummary.my_overdue,
        dueToday: taskSummary.due_today,
        allOpen: taskSummary.all_open,
        unread: messageSummary.unread,
        attention: attention ? attention.total : null,
        stuck: attention ? attention.stuck_count : 0,
      });
    } catch {
      // Silently fail — counts are non-critical
    }
  }, []);

  const loadStaff = useCallback(async () => {
    try {
      setStaff(await staffAPI.list());
    } catch {
      // Assignee pickers and seen-by names degrade gracefully without it
    }
  }, []);

  useEffect(() => {
    authAPI.getMe().then((me) => {
      setCurrentUser({
        ...me,
        name: (`${me.first_name || ''} ${me.last_name || ''}`.trim()) || me.email,
      });
    }).catch(() => {});
    loadStaff();
    refreshCounts();
  }, [refreshCounts, loadStaff]);

  usePollWhileVisible(refreshCounts, 60000);

  // Focus catch-up: someone tabbing back gets fresh data immediately instead
  // of waiting out the poll interval.
  useEffect(() => {
    const catchUp = () => {
      if (document.visibilityState !== 'visible') return;
      refreshCounts();
      setFocusTick((t) => t + 1);
    };
    window.addEventListener('focus', catchUp);
    document.addEventListener('visibilitychange', catchUp);
    return () => {
      window.removeEventListener('focus', catchUp);
      document.removeEventListener('visibilitychange', catchUp);
    };
  }, [refreshCounts]);

  const handleLogout = async () => {
    // Clear the httpOnly auth cookie server-side, then redirect.
    try {
      await authAPI.logout();
    } catch {
      // Ignore network/logout errors — redirect regardless.
    }
    navigate('/workspace/login');
  };

  const sectionProps = { currentUser, staff, refreshCounts, focusTick };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col">
        {/* Workspace Header */}
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
                    Workspace
                  </h1>
                  <p className="text-xs text-slate-500 hidden sm:block leading-tight">Tasks, Shop Feed &amp; Calendar</p>
                </div>
              </div>
              {/* Right: actions */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <Link
                  to="/admin/repair-tracker"
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 text-primary dark:text-blue-400 rounded-xl transition-all text-sm font-bold"
                >
                  <span className="material-symbols-outlined text-base">build_circle</span>
                  <span className="hidden sm:inline">Repair Tracker</span>
                </Link>
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

        {/* Main: sidebar + section content */}
        <div className="flex-1 max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8 w-full">
          <div className="flex flex-col md:flex-row gap-4 lg:gap-6 items-start">
            <WorkspaceSidebar
              activeSection={activeSection}
              counts={counts}
              currentUser={currentUser}
              onChangePassword={() => setShowChangePassword(true)}
            />
            <main className="flex-1 min-w-0 w-full">
              <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-6 shadow-xl shadow-black/5 dark:shadow-black/20 animate-fadeInScale">
                <Suspense fallback={<SectionLoading />}>
                  {activeSection === 'my-tasks' && (
                    <TasksSection key="mine" scope="mine" {...sectionProps} />
                  )}
                  {activeSection === 'all-tasks' && (
                    <TasksSection key="all" scope="all" {...sectionProps} />
                  )}
                  {activeSection === 'calendar' && <TaskCalendar {...sectionProps} />}
                  {activeSection === 'feed' && <FeedSection {...sectionProps} />}
                  {showChangePassword && (
                    <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
                  )}
                </Suspense>
              </div>
            </main>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white/50 dark:bg-slate-900/50 border-t border-slate-200/50 dark:border-slate-800/50 mt-auto">
          <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-slate-600">
              <p className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">hub</span>
                Internal tool — not customer facing
              </p>
              <p>CNS Tool Repair © {new Date().getFullYear()}</p>
            </div>
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}
