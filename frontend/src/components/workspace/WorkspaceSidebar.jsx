import { Link } from 'react-router-dom';
import { WORKSPACE_SECTIONS } from '../../constants/workspace';
import StaffAvatar from './StaffAvatar';

// Badge + attention-dot rules per section, driven by the shared counts poll.
function badgeFor(sectionId, counts) {
  switch (sectionId) {
    case 'my-tasks':
      return { count: counts.myOpen, alert: counts.myOverdue > 0, alertTitle: 'You have overdue tasks' };
    case 'all-tasks':
      // The badge counts open tasks. The dot fires only on STUCK work orders —
      // a shop always has something to quote, so alerting on any attention
      // item would leave the dot on permanently and teach everyone to ignore it.
      return {
        count: counts.allOpen,
        alert: (counts.stuck || 0) > 0,
        alertTitle: `${counts.stuck} work order${counts.stuck === 1 ? '' : 's'} stuck — nothing has moved in a while`,
      };
    case 'calendar':
      return { count: counts.dueToday, alert: false, title: 'Due today' };
    case 'feed':
      return { count: counts.unread, alert: counts.unread > 0, alertTitle: 'Unread shop messages' };
    default:
      return { count: null, alert: false };
  }
}

/**
 * Workspace navigation — a Monday-style left rail on desktop that collapses
 * into a horizontal pill row on phones. Items are real links so
 * open-in-new-tab and back/forward work, same as the tracker tabs.
 * The trailing key button (onChangePassword) is the own-password entry point
 * for staff, who can't reach /admin/settings.
 */
export default function WorkspaceSidebar({ activeSection, counts, currentUser, onChangePassword }) {
  return (
    // w-full matters: the layout row is items-start, so without it the aside
    // shrink-wraps on phones and the flex-1 pills collapse to minimum width.
    <aside className="w-full md:w-56 lg:w-64 flex-shrink-0">
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
        {/* Below sm this copies the Repair Tracker's tab treatment: stacked
            icon-over-tiny-label, with the count badge and alert dot floating
            on the icon's corner. sm..md keeps the inline pill row; md+ is the
            desktop rail. */}
        <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible">
          {WORKSPACE_SECTIONS.map((section) => {
            const active = activeSection === section.id;
            const { count, alert, alertTitle } = badgeFor(section.id, counts);
            const badgeCls = active
              ? 'bg-white/20 text-white'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
            return (
              <Link
                key={section.id}
                to={`/workspace?section=${section.id}`}
                className={`flex-1 md:flex-none min-w-0 flex flex-col sm:flex-row items-center md:justify-start justify-center gap-0.5 sm:gap-2 md:gap-3 px-1 sm:px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-bold text-sm transition-all flex-shrink-0 ${
                  active
                    ? 'bg-primary text-white shadow-md shadow-primary/25'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">{section.icon}</span>
                  {count != null && count > 0 && (
                    <span className={`sm:hidden absolute -top-1.5 -right-2.5 text-[10px] font-black px-1 py-0 rounded-full min-w-[16px] text-center leading-tight ${badgeCls}`}>
                      {count}
                    </span>
                  )}
                  {alert && !active && (
                    <span className="sm:hidden absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" title={alertTitle} />
                  )}
                </div>
                <span className="sm:hidden text-[10px] tracking-tight leading-tight truncate max-w-full">{section.shortLabel || section.label}</span>
                <span className="hidden sm:block min-w-0 truncate md:flex-1 text-left leading-tight whitespace-nowrap">{section.label}</span>
                {count != null && count > 0 && (
                  <span className={`hidden sm:inline text-xs font-black px-2 py-0.5 rounded-full min-w-[22px] text-center leading-none ${badgeCls}`}>
                    {count}
                  </span>
                )}
                {alert && !active && (
                  <span className="hidden sm:flex w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" title={alertTitle} />
                )}
              </Link>
            );
          })}
          <button
            onClick={onChangePassword}
            title="Change my password"
            className="flex-1 md:flex-none min-w-0 flex flex-col sm:flex-row items-center md:justify-start justify-center gap-0.5 sm:gap-2 md:gap-3 px-1 sm:px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-bold text-sm transition-all flex-shrink-0 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 md:mt-1 md:border-t md:border-slate-200 md:dark:border-slate-800 md:rounded-t-none md:pt-3"
          >
            <span className="material-symbols-outlined text-xl">key</span>
            <span className="sm:hidden text-[10px] tracking-tight leading-tight truncate max-w-full">Password</span>
            <span className="hidden sm:block min-w-0 truncate md:flex-1 text-left leading-tight whitespace-nowrap">Password</span>
          </button>
        </nav>
      </div>
    </aside>
  );
}
