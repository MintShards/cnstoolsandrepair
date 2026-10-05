import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TaskCalendar from './TaskCalendar';
import PeopleActivityView from './PeopleActivityView';

const VIEWS = [
  { id: 'calendar', icon: 'calendar_month', label: 'Calendar', sub: 'By day' },
  { id: 'people', icon: 'groups', label: 'People', sub: 'By person' },
];

/**
 * The Calendar section's two faces: the month grid (what happened each day)
 * and the People view (what each person did). Same events, grouped the
 * other way; `?view=people` deep-links the second.
 */
export default function ActivitySection(props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState(() => (searchParams.get('view') === 'people' ? 'people' : 'calendar'));

  const select = (id) => {
    setView(id);
    const next = new URLSearchParams(searchParams);
    if (id === 'people') next.set('view', 'people');
    else next.delete('view');
    setSearchParams(next, { replace: true });
  };

  return (
    <div>
      <div className="flex w-full sm:w-auto sm:inline-flex rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden mb-4" role="group" aria-label="Calendar or people">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => select(v.id)}
            aria-pressed={view === v.id}
            title={v.sub}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 min-h-11 sm:min-h-0 text-sm font-bold transition-colors ${
              view === v.id
                ? 'bg-primary text-white'
                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-base">{v.icon}</span>
            {v.label}
            <span className={`hidden md:inline text-xs font-medium ${view === v.id ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>· {v.sub}</span>
          </button>
        ))}
      </div>
      {view === 'people' ? <PeopleActivityView {...props} /> : <TaskCalendar {...props} />}
    </div>
  );
}
