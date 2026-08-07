import { useState, useEffect, useCallback } from 'react';
import { routesAPI, visitsAPI, zonesAPI, salesRepsAPI } from '../../../services/api';
import { useToast } from '../../../pages/sales/SalesDashboard';
import VisitLogger from '../VisitLogger';
import RoutePlanner from '../RoutePlanner';
import ConfirmModal from '../ConfirmModal';
import InterestDot from '../InterestDot';
import { ICON_BTN, BTN_PRIMARY, BTN_NEUTRAL } from '../ui';
import { apiErrorMessage } from '../../../utils/apiError';
import { formatTimePacific, formatYmd, getTodayPacific } from '../../../utils/dateFormat';
import { routeNavUrl, stopNavUrl, telHref, MAX_NAV_STOPS } from '../../../utils/maps';

// Icon-only action set shared by every pending stop row. Neutral chrome —
// the semantic colour only shows on hover, like the tracker's row actions.
function StopActions({ stop, onLogVisit, onDone, completing }) {
  const nav = stopNavUrl(stop);
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {nav && (
        <a
          href={nav}
          target="_blank"
          rel="noopener noreferrer"
          title={`Navigate to ${stop.company_name || 'stop'}`}
          aria-label={`Navigate to ${stop.company_name || 'stop'}`}
          className={`${ICON_BTN} hover:text-blue-600 dark:hover:text-blue-400`}
        >
          <span className="material-symbols-outlined text-base">navigation</span>
        </a>
      )}
      {stop.phone && (
        <a
          href={telHref(stop.phone)}
          title={`Call ${stop.phone}`}
          aria-label={`Call ${stop.company_name || 'stop'}`}
          className={`${ICON_BTN} hover:text-slate-700 dark:hover:text-white`}
        >
          <span className="material-symbols-outlined text-base">call</span>
        </a>
      )}
      <button
        onClick={onLogVisit}
        title="Log a visit"
        aria-label={`Log visit at ${stop.company_name || 'stop'}`}
        className={`${ICON_BTN} hover:text-primary`}
      >
        <span className="material-symbols-outlined text-base">edit_note</span>
      </button>
      <button
        onClick={onDone}
        disabled={completing}
        title="Mark done without logging a visit"
        aria-label={`Mark ${stop.company_name || 'stop'} done`}
        className={`${ICON_BTN} hover:text-green-600 dark:hover:text-green-400 disabled:opacity-50`}
      >
        <span className={`material-symbols-outlined text-base ${completing ? 'animate-spin' : ''}`}>
          {completing ? 'progress_activity' : 'check_circle'}
        </span>
      </button>
    </div>
  );
}

export default function TodayRouteTab({ currentUser, onTabSwitch, refreshSignal = 0, onMutate, onTodayCount }) {
  const showToast = useToast();
  const isAdmin = currentUser?.role === 'admin';
  const [routes, setRoutes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visitTarget, setVisitTarget] = useState(null);
  const [completingIdx, setCompletingIdx] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  const [confirmDeleteRun, setConfirmDeleteRun] = useState(false);
  const [zones, setZones] = useState([]);
  const [reps, setReps] = useState([]);
  const [dueCount, setDueCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await routesAPI.getToday();
      setRoutes(data);
      onTodayCount?.(data.length);
      // Auto-select: keep current selection if still valid, else pick first
      setSelectedId(prev => {
        if (prev && data.find(r => r.id === prev)) return prev;
        return data.length > 0 ? data[0].id : null;
      });
    } catch (err) {
      if (err.response?.status !== 404) {
        showToast('error', "Failed to load today's route.");
      }
      setRoutes([]);
      setSelectedId(null);
      onTodayCount?.(0);
    } finally {
      setLoading(false);
    }
  }, [showToast, onTodayCount]);

  // refreshSignal bumps when the route list below this runner mutates a route.
  useEffect(() => { load(); }, [load, refreshSignal]);

  // Follow-ups due today belong on this screen — "who do I owe a call-back"
  // is part of the day's run, not a separate errand.
  useEffect(() => {
    let cancelled = false;
    visitsAPI.getFollowUps({ limit: 100 })
      .then(({ data }) => {
        if (cancelled) return;
        const today = getTodayPacific();
        setDueCount(data.filter(f => f.follow_up_date && f.follow_up_date <= today).length);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Data the planner needs. The reps endpoint is admin-only, so a rep's
  // planner just gets an empty list (it never shows the assign field anyway).
  useEffect(() => {
    zonesAPI.list().then(setZones).catch(() => {});
    if (isAdmin) salesRepsAPI.list().then(setReps).catch(() => {});
  }, [isAdmin]);

  const handleVisitLogged = () => {
    setVisitTarget(null);
    showToast('success', 'Visit logged successfully.');
    load();
    onMutate?.();
  };

  // Non-destructive: the run leaves this screen but stays in Run History.
  const handleClearRun = async (routeId) => {
    setConfirmDeleteRun(false);
    try {
      await routesAPI.dismiss(routeId);
      showToast('success', 'Run cleared from today — still in Run History.');
      load();
      onMutate?.();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to clear the run.'));
    }
  };

  const handleMarkDone = async (routeId, idx) => {
    setCompletingIdx(idx);
    try {
      const updated = await routesAPI.completeStop(routeId, idx);
      setRoutes(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      onMutate?.();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to mark the stop done.'));
    } finally {
      setCompletingIdx(null);
    }
  };

  const followUpsChip = dueCount > 0 && (
    <button
      onClick={() => onTabSwitch('follow-ups')}
      className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-bold transition-all"
    >
      <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
      {dueCount} follow-up{dueCount !== 1 ? 's' : ''} due
      <span className="material-symbols-outlined text-base">chevron_right</span>
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-4xl text-slate-400">route</span>
        </div>
        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">No Route Today</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
          Start a saved route below and the full list becomes today&apos;s run.
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {followUpsChip}
        </div>
      </div>
    );
  }

  const route = routes.find(r => r.id === selectedId) || routes[0];
  const completedCount = route.stops_completed ?? 0;
  const total = route.stops_total ?? 0;
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // Absolute index rides along with each stop — the completion endpoint targets
  // the position in the stored array, not in any filtered view of it.
  const indexed = (route.stops || []).map((s, idx) => ({ ...s, idx }));
  const pending = indexed.filter(s => !s.completed);
  const done = indexed.filter(s => s.completed);
  const hero = pending[0] || null;
  const rest = pending.slice(1);
  const nav = routeNavUrl(pending);
  const heroNav = hero ? stopNavUrl(hero) : null;

  return (
    <div>
      {/* Route selector — only shown when multiple routes exist today. On a
          phone each run is one slim card with just the necessities; desktop
          chips add rep, start time and a mini progress bar to tell
          otherwise-identical runs apart. */}
      {routes.length > 1 && (
        <div className="flex flex-col gap-2 mb-5 sm:flex-row sm:flex-wrap">
          {routes.map(r => {
            const isSelected = r.id === route.id;
            const c = r.stops_completed ?? 0;
            const t = r.stops_total ?? 0;
            const pct = t > 0 ? Math.round((c / t) * 100) : 0;
            const runDone = t > 0 && c === t;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full sm:w-auto px-3.5 py-2.5 sm:py-2 rounded-xl border text-left transition-colors text-sm ${
                  isSelected
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary/30'
                }`}
              >
                <span className="flex items-center justify-between sm:justify-start gap-2">
                  <span className="flex items-center gap-1.5 font-black uppercase tracking-tight text-xs truncate">
                    {r.name || 'Route'}
                    {runDone && (
                      <span className="material-symbols-outlined text-sm text-green-500">check_circle</span>
                    )}
                  </span>
                  <span className="text-xs font-bold opacity-80 whitespace-nowrap sm:hidden">
                    {c}/{t}
                  </span>
                </span>
                <span className="hidden sm:block text-xs opacity-70 whitespace-nowrap">
                  {isAdmin ? `${r.assigned_to_name || 'Unknown Rep'} · ` : ''}
                  {c}/{t} · started {formatTimePacific(r.created_at)}
                </span>
                <span className="hidden sm:block mt-1.5 h-1 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <span
                    className={`block h-full rounded-full transition-all ${runDone ? 'bg-green-500' : 'bg-primary'}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Route header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {route.name || "Today's Route"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {route.zone_name && <span className="mr-2">{route.zone_name}</span>}
            {route.assigned_to_name && routes.length > 1 && <span className="mr-2">Rep: {route.assigned_to_name}</span>}
            {completedCount} of {total} stops completed
          </p>
        </div>
        {/* Progress bar */}
        <div className="sm:w-48">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Action bar: one launch for the whole remaining run */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {nav && pending.length > 0 && (
          <a href={nav.url} target="_blank" rel="noopener noreferrer" className={BTN_PRIMARY}>
            <span className="material-symbols-outlined text-lg">navigation</span>
            {pending.length <= MAX_NAV_STOPS
              ? `Navigate ${pending.length} stop${pending.length !== 1 ? 's' : ''}`
              : `Navigate next ${nav.included} of ${pending.length}`}
          </a>
        )}
        <button onClick={() => setShowPlanner(true)} className={`${BTN_NEUTRAL} text-xs`}>
          <span className="material-symbols-outlined text-base">edit_location_alt</span>
          Edit Route
        </button>
        {followUpsChip}
        <button
          onClick={() => setConfirmDeleteRun(true)}
          title="Clear from today — kept in Run History"
          aria-label={`Clear ${route.name || "today's run"} from today`}
          className={`${ICON_BTN} hover:text-slate-700 dark:hover:text-white ml-auto`}
        >
          <span className="material-symbols-outlined text-base">archive</span>
        </button>
      </div>

      {route.stops?.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">
          This route has no stops yet — add some with Edit Route.
        </p>
      ) : (
        <>
          {/* Up-next card, or the finish line */}
          {hero ? (
            <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/60 p-4 sm:p-5">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">near_me</span>
                Up Next — Stop {hero.idx + 1} of {total}
              </p>
              <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {hero.company_name || 'Unknown Business'}
                </h3>
                {hero.interest_level && <InterestDot level={hero.interest_level} />}
              </div>
              {hero.address && (
                <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-slate-400">location_on</span>
                  {hero.address}
                </p>
              )}
              {hero.notes && (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-1 truncate" title={hero.notes}>
                  {hero.notes}
                </p>
              )}
              <div className="grid grid-cols-2 sm:flex gap-2 mt-4">
                {heroNav && (
                  <a href={heroNav} target="_blank" rel="noopener noreferrer" className={BTN_PRIMARY}>
                    <span className="material-symbols-outlined text-base">navigation</span>
                    Navigate
                  </a>
                )}
                {hero.phone && (
                  <a href={telHref(hero.phone)} className={BTN_NEUTRAL}>
                    <span className="material-symbols-outlined text-base">call</span>
                    Call
                  </a>
                )}
                <button
                  onClick={() => setVisitTarget({
                    businessId: hero.business_id,
                    businessName: hero.company_name,
                    routeId: route.id,
                    initialInterest: hero.interest_level,
                  })}
                  className={BTN_NEUTRAL}
                >
                  <span className="material-symbols-outlined text-base">edit_note</span>
                  Log Visit
                </button>
                <button
                  onClick={() => handleMarkDone(route.id, hero.idx)}
                  disabled={completingIdx === hero.idx}
                  title="Mark done without logging a visit"
                  className={`${BTN_NEUTRAL} disabled:opacity-50`}
                >
                  <span className={`material-symbols-outlined text-base ${completingIdx === hero.idx ? 'animate-spin' : ''}`}>
                    {completingIdx === hero.idx ? 'progress_activity' : 'check_circle'}
                  </span>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/60 p-5 text-center">
              <span className="material-symbols-outlined text-3xl text-green-500 mb-1">check_circle</span>
              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Route Complete
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                All {total} stops done. Nice work.
              </p>
            </div>
          )}

          {/* Coming up */}
          {rest.length > 0 && (
            <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Coming Up ({rest.length})
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-700/60">
                {rest.map(stop => (
                  <div key={stop.idx} className="p-3 sm:px-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-300">
                        {stop.idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight truncate">
                            {stop.company_name || 'Unknown Business'}
                          </h3>
                          {stop.interest_level && <InterestDot level={stop.interest_level} />}
                        </div>
                        {stop.address && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{stop.address}</p>
                        )}
                      </div>
                      <StopActions
                        stop={stop}
                        completing={completingIdx === stop.idx}
                        onLogVisit={() => setVisitTarget({
                          businessId: stop.business_id,
                          businessName: stop.company_name,
                          routeId: route.id,
                          initialInterest: stop.interest_level,
                        })}
                        onDone={() => handleMarkDone(route.id, stop.idx)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed stops fold away — the day ahead stays front and centre */}
          {done.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowCompleted(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                  <span className="material-symbols-outlined text-base text-green-500">check_circle</span>
                  Completed ({done.length})
                </span>
                <span className="material-symbols-outlined text-slate-400">
                  {showCompleted ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {showCompleted && (
                <div className="mt-2 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 divide-y divide-slate-200 dark:divide-slate-700/60 overflow-hidden">
                  {done.map(stop => (
                    <div key={stop.idx} className="flex items-start gap-3 px-4 py-2.5 opacity-70 hover:opacity-100 transition-opacity">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-slate-700/60 text-green-600 dark:text-green-400">
                        <span className="material-symbols-outlined text-sm">check</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
                            {stop.company_name || 'Unknown Business'}
                          </p>
                          {stop.interest_level && <InterestDot level={stop.interest_level} />}
                          {stop.follow_up_date && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap"
                              title={`Follow-up ${formatYmd(stop.follow_up_date)}${stop.follow_up_note ? ` — ${stop.follow_up_note}` : ''}`}
                            >
                              <span className="material-symbols-outlined text-xs">event_upcoming</span>
                              {formatYmd(stop.follow_up_date)}
                            </span>
                          )}
                        </div>
                        {/* The outcome line: what that check mark actually means. */}
                        {stop.visit_id ? (
                          stop.visit_notes ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic truncate mt-0.5" title={stop.visit_notes}>
                              &ldquo;{stop.visit_notes}&rdquo;
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Visit logged</p>
                          )
                        ) : (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Done — no visit logged</p>
                        )}
                      </div>
                      {/* A ticked-off stop can still be written up after the fact. */}
                      {!stop.visit_id && (
                        <button
                          onClick={() => setVisitTarget({
                            businessId: stop.business_id,
                            businessName: stop.company_name,
                            routeId: route.id,
                            initialInterest: stop.interest_level,
                          })}
                          title="Write up this visit"
                          aria-label={`Log visit at ${stop.company_name || 'stop'}`}
                          className={`${ICON_BTN} hover:text-primary flex-shrink-0`}
                        >
                          <span className="material-symbols-outlined text-base">edit_note</span>
                        </button>
                      )}
                      {stop.completed_at && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0 pt-1">
                          {formatTimePacific(stop.completed_at)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {visitTarget && (
        <VisitLogger
          {...visitTarget}
          onSuccess={handleVisitLogged}
          onClose={() => setVisitTarget(null)}
        />
      )}

      {showPlanner && (
        <RoutePlanner
          route={route}
          reps={reps}
          zones={zones}
          currentUser={currentUser}
          onSuccess={() => { setShowPlanner(false); showToast('success', 'Route updated.'); load(); onMutate?.(); }}
          onClose={() => setShowPlanner(false)}
        />
      )}

      {confirmDeleteRun && (
        <ConfirmModal
          message={`Clear "${route.name || "today's run"}" from today's view? It stays in Run History with its progress.`}
          confirmLabel="Clear"
          confirmClass="bg-primary hover:bg-blue-500"
          onConfirm={() => handleClearRun(route.id)}
          onCancel={() => setConfirmDeleteRun(false)}
        />
      )}
    </div>
  );
}
