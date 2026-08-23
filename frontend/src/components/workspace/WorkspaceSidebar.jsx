import { Link } from 'react-router-dom';
import { WORKSPACE_SECTIONS } from '../../constants/workspace';
import StaffAvatar from './StaffAvatar';

// Badge + attention-dot rules per section, driven by the shared counts poll.
function badgeFor(sectionId, counts) {
  switch (sectionId) {
    case 'my-tasks':
      return { count: counts.myOpen, alert: counts.myOverdue > 0, alertTitle: 'You have overdue tasks' };
    case 'all-tasks':
      return { count: counts.allOpen, alert: false };
    case 'calendar':
      return { count: counts.dueToday, alert: false, title: 'Due today' };
    case 'feed':
      return { count: counts.unread, alert: counts.unread > 0, alertTitle: 'Unread shop messages' };
    default:
      return { count: null, alert: false };
  }
}

/**
 * Shop Hub navigation — a Monday-style left rail on desktop that collapses
 * into a horizontal pill row on phones. Items are real links so
 * open-in-new-tab and back/forward work, same as the tracker tabs.
 */
export default function WorkspaceSidebar({ activeSection, counts, currentUser }) {
  return (
    <aside className="md:w-56 lg:w-64 flex-shrink-0">
      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-1.5 md:p-3 shadow-lg shadow-black/5 dark:shadow-black/20 md:sticky md:top-6">
        {currentUser && (
          <div className="hidden md:flex items-center gap-2.5 px-2 pt-1 pb-3 mb-2 border-b border-slate-200 dark:border-slate-800">
            <StaffAvatar userId={currentUser.id} name={currentUser.name} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{currentUser.email}</p>
            </div>
          </div>
        )}
        <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible">
          {WORKSPACE_SECTIONS.map((section) => {
            const active = activeSection === section.id;
            const { count, alert, alertTitle } = badgeFor(section.id, counts);
            return (
              <Link
                key={section.id}
                to={`/workspace?section=${section.id}`}
                className={`relative flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap flex-shrink-0 ${
                  active
                    ? 'bg-primary text-white shadow-md shadow-primary/25'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-xl">{section.icon}</span>
                <span className="hidden sm:inline md:flex-1">{section.label}</span>
                {count != null && count > 0 && (
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full min-w-[22px] text-center leading-none ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {count}
                  </span>
                )}
                {alert && !active && (
                  <span
                    className="absolute top-1.5 right-1.5 md:static w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0"
                    title={alertTitle}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
