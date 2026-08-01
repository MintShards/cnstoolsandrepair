import { useState, useEffect, useCallback } from 'react';
import { routesAPI, salesRepsAPI, zonesAPI } from '../../../services/api';
import { useToast } from '../../../pages/sales/SalesDashboard';
import { apiErrorMessage } from '../../../utils/apiError';
import { formatYmd } from '../../../utils/dateFormat';
import RoutePlanner from '../RoutePlanner';
import ConfirmModal from '../ConfirmModal';
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
  const [confirmRoute, setConfirmRoute] = useState(null);
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

  const handleDelete = (route) => {
    setConfirmRoute(route);
  };

  const confirmDelete = async () => {
    const route = confirmRoute;
    setConfirmRoute(null);
    try {
      await routesAPI.delete(route.id);
      showToast('success', 'Route deleted.');
      load(currentPage, pageSize);
      onMutate?.();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to delete route.'));
    }
  };

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
                    {/* The word "Actions" is wider than the buttons under it —
                        on a phone that stole ~60px and pushed them off screen. */}
                    <th className="py-3 px-2 sm:px-4 text-right font-bold">
                      <span className="sr-only sm:not-sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                  {routes.map((route) => {
                    const done = route.stops_completed ?? 0;
                    const stops = route.stops_total ?? 0;
                    const progress = stops > 0 ? Math.round((done / stops) * 100) : 0;
                    const complete = stops > 0 && done === stops;
                    return (
                      <tr
                        key={route.id}
                        onClick={() => { setEditRoute(route); setShowPlanner(true); }}
                        className="hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                          <div className="text-slate-900 dark:text-white font-bold">{formatYmd(route.date)}</div>
                          <div className="text-slate-500 dark:text-slate-400 text-sm sm:hidden truncate">
                            {route.name || 'Untitled route'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 hidden sm:table-cell max-w-[200px]">
                          <span className="text-slate-900 dark:text-white font-bold uppercase truncate block">
                            {route.name || <span className="font-normal normal-case text-slate-400 dark:text-slate-600">Untitled</span>}
                          </span>
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
                          {route.zone_name || zoneName(route.zone_id) || <span className="text-slate-400 dark:text-slate-600">—</span>}
                        </td>
                        <td className="py-3.5 px-2 sm:px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleDelete(route)}
                              title="Delete route"
                              aria-label={`Delete route ${route.name || formatYmd(route.date)}`}
                              className={`${ICON_BTN} hover:text-red-500 dark:hover:text-red-400`}
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
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

      {confirmRoute && (
        <ConfirmModal
          message={`Delete route "${confirmRoute.name || formatYmd(confirmRoute.date)}"? This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmRoute(null)}
        />
      )}
    </div>
  );
}
