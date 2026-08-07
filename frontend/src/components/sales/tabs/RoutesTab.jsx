import { useState, useEffect, useCallback, Fragment } from 'react';
import { routesAPI, salesRepsAPI, zonesAPI } from '../../../services/api';
import { useToast } from '../../../pages/sales/SalesDashboard';
import { formatTimePacific, formatYmd } from '../../../utils/dateFormat';
import RoutePlanner from '../RoutePlanner';
import InterestDot from '../InterestDot';
import SortableTh from '../SortableTh';
import TabHeader from '../TabHeader';
import { ICON_BTN, FILTER_INPUT, FILTER_CLEAR } from '../ui';
import useSort from '../useSort';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../pageSize';
import PaginationBar from '../../admin/shared/PaginationBar';

// Newest routes and least-finished routes are the useful first click.
const FIRST_DIRS = { date: 'desc', progress: 'asc' };

export default function RoutesTab({ currentUser, refreshSignal = 0, onMutate, hideHeader = false, zoneId = '' }) {
  const showToast = useToast();
  const isAdmin = currentUser?.role === 'admin';
  const [routes, setRoutes] = useState([]);
  const [reps, setReps] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRep, setFilterRep] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [showPlanner, setShowPlanner] = useState(false);
  const [editRoute, setEditRoute] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const { sortBy, sortDir, handleSort } = useSort(
    'date', 'desc', FIRST_DIRS, () => setCurrentPage(1),
  );

  const load = useCallback(async (page, size) => {
    setLoading(true);
    try {
      const params = { skip: (page - 1) * size, limit: size, sort_by: sortBy, sort_dir: sortDir };
      if (filterRep) params.assigned_to = filterRep;
      if (filterDate) params.date = filterDate;
      // Embedded in a zone screen: only that zone's runs (children included —
      // the backend zone filter is descendant-aware).
      if (zoneId) params.zone_id = zoneId;
      const { data, total: t } = await routesAPI.list(params);
      setRoutes(data);
      setTotal(t);
    } catch {
      showToast('error', 'Failed to load routes.');
    } finally {
      setLoading(false);
    }
  }, [filterRep, filterDate, sortBy, sortDir, zoneId, showToast]);

  useEffect(() => {
    // The reps endpoint is admin-only; a rep's list is already scoped to self.
    Promise.all([isAdmin ? salesRepsAPI.list() : Promise.resolve([]), zonesAPI.list()])
      .then(([r, z]) => { setReps(r); setZones(z); })
      .catch(() => {});
  }, [isAdmin]);

  // `load` is re-created when a filter changes, and the filter setters reset the
  // page, so this single effect covers mount, filtering and paging with one fetch.
  // refreshSignal bumps when the runner above mutates a route (stop done, edit).
  useEffect(() => {
    load(currentPage, pageSize);
  }, [load, currentPage, pageSize, refreshSignal]);

  const repName = (id) => {
    const r = reps.find(r => r.id === id);
    if (!r) return 'Unknown';
    return `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email;
  };

  const zoneName = (id) => zones.find(z => z.id === id)?.name || '';

  return (
    <div>
      {/* Header — a record, not a workbench: runs are born from saved routes
          and zones, so there's no create button here. */}
      <TabHeader
        title={hideHeader ? undefined : 'Run History'}
        subtitle={hideHeader ? undefined : 'Past runs and their progress'}
      >
        {isAdmin && (
          <select
            value={filterRep}
            onChange={(e) => { setFilterRep(e.target.value); setCurrentPage(1); }}
            className={FILTER_INPUT}
          >
            <option value="">All Reps</option>
            {reps.map(r => (
              <option key={r.id} value={r.id}>
                {`${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email}
              </option>
            ))}
          </select>
        )}
        <input
          type="date"
          value={filterDate}
          onChange={(e) => { setFilterDate(e.target.value); setCurrentPage(1); }}
          className={FILTER_INPUT}
        />
        {(filterRep || filterDate) && (
          <button
            onClick={() => { setFilterRep(''); setFilterDate(''); setCurrentPage(1); }}
            className={FILTER_CLEAR}
          >
            <span className="material-symbols-outlined text-sm">close</span>
            Clear
          </button>
        )}
      </TabHeader>

      {/* Table */}
      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Run History</span>
          <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{total}</span>
        </div>

        {loading && routes.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-3 text-slate-500 dark:text-slate-400">Loading routes...</p>
          </div>
        ) : routes.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-3">directions</span>
            <p className="text-slate-500 dark:text-slate-400 font-medium">No runs yet — start a saved route and it lands here</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-base text-left">
                <thead className="text-sm uppercase text-slate-500 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60">
                  <tr>
                    {[
                      { field: 'date',             label: 'Date',     cls: 'px-3 sm:px-4' },
                      { field: 'name',             label: 'Route',    cls: 'px-4 hidden sm:table-cell' },
                      // A rep only ever sees their own routes — the column is noise.
                      ...(isAdmin ? [{ field: 'assigned_to_name', label: 'Rep', cls: 'px-4 hidden md:table-cell' }] : []),
                      { field: 'progress',         label: 'Progress', cls: 'px-2 sm:px-4' },
                    ].map(col => (
                      <SortableTh key={col.field} {...col} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    ))}
                    {/* Zone comes from a join, and the rep filter covers the same need */}
                    <th className="py-3 px-4 font-bold hidden xl:table-cell">Zone</th>
                    <th className="py-3 px-2 sm:px-4 text-right font-bold">
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                  {routes.map((route) => {
                    const done = route.stops_completed ?? 0;
                    const stops = route.stops_total ?? 0;
                    const progress = stops > 0 ? Math.round((done / stops) * 100) : 0;
                    const complete = stops > 0 && done === stops;
                    const expanded = expandedId === route.id;
                    // What actually came out of the run — visible without
                    // expanding, since these are why history gets consulted.
                    const visitsLogged = (route.stops || []).filter(s => s.visit_id).length;
                    const followUps = (route.stops || []).filter(s => s.follow_up_date).length;
                    const context = (visitsLogged > 0 || followUps > 0 || route.dismissed || route.saved_route_id) && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 font-normal normal-case">
                        {route.saved_route_id && (
                          <span className="material-symbols-outlined text-sm" title="Started from a saved route">bookmark</span>
                        )}
                        {visitsLogged > 0 && <span>{visitsLogged} visit{visitsLogged !== 1 ? 's' : ''}</span>}
                        {followUps > 0 && <span>{followUps} follow-up{followUps !== 1 ? 's' : ''}</span>}
                        {route.dismissed && (
                          <span
                            className="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wide"
                            title="Cleared from the Today view — progress and visits kept"
                          >
                            cleared
                          </span>
                        )}
                      </div>
                    );
                    return (
                      <Fragment key={route.id}>
                      <tr
                        onClick={() => setExpandedId(expanded ? null : route.id)}
                        className="hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                          <div className="text-slate-900 dark:text-white font-bold">{formatYmd(route.date)}</div>
                          <div className="text-slate-500 dark:text-slate-400 text-sm sm:hidden truncate">
                            {route.name || 'Untitled route'}
                          </div>
                          {context && <div className="sm:hidden mt-0.5">{context}</div>}
                        </td>
                        <td className="py-3.5 px-4 hidden sm:table-cell max-w-[200px]">
                          <span className="text-slate-900 dark:text-white font-bold uppercase truncate block">
                            {route.name || <span className="font-normal normal-case text-slate-400 dark:text-slate-600">Untitled</span>}
                          </span>
                          {context && <div className="mt-0.5">{context}</div>}
                        </td>
                        {isAdmin && (
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 text-sm hidden md:table-cell whitespace-nowrap">
                            {route.assigned_to_name || repName(route.assigned_to)}
                          </td>
                        )}
                        <td className="py-3.5 px-2 sm:px-4 sm:min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 min-w-[36px] max-w-[60px] sm:max-w-[90px] bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${complete ? 'bg-green-500' : 'bg-primary'}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold whitespace-nowrap ${complete ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                              {done}/{stops}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 text-sm hidden xl:table-cell">
                          {route.zone_path || route.zone_name || zoneName(route.zone_id) || <span className="text-slate-400 dark:text-slate-600">—</span>}
                        </td>
                        <td className="py-3.5 px-2 sm:px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => { setEditRoute(route); setShowPlanner(true); }}
                              title="Edit run"
                              aria-label={`Edit run ${route.name || formatYmd(route.date)}`}
                              className={`${ICON_BTN} hover:text-slate-700 dark:hover:text-white`}
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button
                              onClick={() => setExpandedId(expanded ? null : route.id)}
                              title={expanded ? 'Hide stops' : 'Show stops'}
                              aria-label={`${expanded ? 'Hide' : 'Show'} stops for ${route.name || formatYmd(route.date)}`}
                              aria-expanded={expanded}
                              className={ICON_BTN}
                            >
                              <span className="material-symbols-outlined text-base">{expanded ? 'expand_less' : 'expand_more'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* The run's account: which doors, and what happened at each. */}
                      {expanded && (
                        <tr className="bg-slate-50 dark:bg-slate-800/30">
                          <td colSpan={6} className="px-4 sm:px-6 py-2">
                            {/* w-0 + min-w-full keeps long visit notes from
                                widening the table past the phone viewport —
                                the cell truncates instead of scrolling. */}
                            <div className="w-0 min-w-full">
                            {(route.stops || []).length === 0 ? (
                              <p className="text-xs text-slate-400 dark:text-slate-500 py-2">No stops on this run.</p>
                            ) : (
                              <div className="divide-y divide-slate-200 dark:divide-slate-700/40">
                                {route.stops.map((stop) => (
                                  <div key={stop.order} className="py-2 flex items-start gap-2.5">
                                    <span className={`material-symbols-outlined text-base mt-0.5 ${stop.completed ? 'text-green-500' : 'text-slate-300 dark:text-slate-600'}`}>
                                      {stop.completed ? 'check_circle' : 'radio_button_unchecked'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                          {stop.company_name || 'Unknown Business'}
                                        </span>
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
                                      {stop.completed ? (
                                        stop.visit_id ? (
                                          stop.visit_notes ? (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 italic truncate mt-0.5" title={stop.visit_notes}>
                                              &ldquo;{stop.visit_notes}&rdquo;
                                            </p>
                                          ) : (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Visit logged</p>
                                          )
                                        ) : (
                                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Done — no visit logged</p>
                                        )
                                      ) : (
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Not visited</p>
                                      )}
                                    </div>
                                    {stop.completed_at && (
                                      <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap pt-0.5">
                                        {formatTimePacific(stop.completed_at)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <PaginationBar
              currentPage={currentPage}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={(page) => setCurrentPage(page)}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          </>
        )}
      </div>

      {showPlanner && (
        <RoutePlanner
          route={editRoute}
          reps={reps}
          zones={zones}
          currentUser={currentUser}
          onSuccess={() => { setShowPlanner(false); load(currentPage, pageSize); showToast('success', 'Route updated.'); onMutate?.(); }}
          onClose={() => setShowPlanner(false)}
        />
      )}

    </div>
  );
}
