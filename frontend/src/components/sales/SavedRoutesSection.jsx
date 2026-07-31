import { useState, useEffect, useCallback } from 'react';
import { savedRoutesAPI, routesAPI, zonesAPI } from '../../services/api';
import { useToast } from '../../pages/sales/SalesDashboard';
import SavedRouteEditor from './SavedRouteEditor';
import CoverageBar from './CoverageBar';
import { ICON_BTN } from './ui';
import { apiErrorMessage } from '../../utils/apiError';
import { getTodayPacific } from '../../utils/dateFormat';

/**
 * The standing route library: build a list once, start it any day. Starting
 * stamps out a normal dated run for the runner above — assigned to whoever
 * pressed Start.
 */
export default function SavedRoutesSection({ zoneId, zones: zonesProp, onChanged }) {
  const showToast = useToast();
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [fetchedZones, setFetchedZones] = useState([]);
  // A host that already holds the zone list passes it in; only self-fetch
  // when standalone (the Routes tab library).
  const zones = zonesProp ?? fetchedZones;
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [startingId, setStartingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Inside a zone screen the section shows only that zone's routes —
      // the route belongs to the zone.
      setSavedRoutes(await savedRoutesAPI.list(zoneId ? { zone_id: zoneId } : {}));
    } catch {
      showToast('error', 'Failed to load saved routes.');
    } finally {
      setLoading(false);
    }
  }, [showToast, zoneId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!zonesProp) zonesAPI.list().then(setFetchedZones).catch(() => {});
  }, [zonesProp]);

  const startRoute = async (sr) => {
    setStartingId(sr.id);
    try {
      // A saved route starts as a normal dated run; assigned_to is omitted so
      // the backend assigns whoever pressed Start. saved_route_id is what
      // lets the completed run count as a sweep of this route.
      await routesAPI.create({
        name: sr.name,
        date: getTodayPacific(),
        zone_id: sr.zone_id || null,
        saved_route_id: sr.id,
        stops: sr.business_ids.map((id, i) => ({
          business_id: id, order: i, completed: false, completed_at: null,
        })),
      });
      showToast('success', `${sr.name} started — it's in today's route.`);
      onChanged?.();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to start the route.'));
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div>
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
        {/* Card-strip header — sections never outrank the screen title. */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Saved Routes</span>
          <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
            {savedRoutes.length}
          </span>
          {/* A route belongs to its zone, so creating one only happens from
              inside a zone screen — the cross-zone library just starts them. */}
          {zoneId && (
            <button
              onClick={() => { setEditTarget(null); setShowEditor(true); }}
              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 hover:text-primary rounded-lg text-xs font-bold transition-all"
            >
              <span className="material-symbols-outlined text-sm">bookmark_add</span>
              New Saved Route
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-10">
            <span className="material-symbols-outlined animate-spin text-2xl text-slate-400">progress_activity</span>
          </div>
        ) : savedRoutes.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10">
            {zoneId
              ? 'No saved routes in this zone yet — build one once, then start it any day with one tap.'
              : 'No saved routes yet — open a zone in the Zones tab and create its routes there.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700/60">
            {savedRoutes.map((sr) => (
              <div key={sr.id} className="p-3 sm:px-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center flex-shrink-0 text-slate-500 dark:text-slate-300">
                  <span className="material-symbols-outlined text-base">route</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight truncate">
                    {sr.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {sr.zone_name ? `${sr.zone_name} · ` : ''}
                    {sr.business_count} business{sr.business_count !== 1 ? 'es' : ''}
                    {' · '}
                    {sr.times_swept > 0 ? `swept ${sr.times_swept}×` : 'never swept'}
                  </p>
                  {/* Same coverage read as zones: members visited in the window. */}
                  <div className="mt-1 max-w-[160px]">
                    <CoverageBar
                      pct={sr.coverage_pct}
                      covered={sr.covered_count}
                      total={sr.business_count}
                      windowDays={sr.coverage_window_days}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => startRoute(sr)}
                    disabled={startingId === sr.id || sr.business_count === 0}
                    title={`Start ${sr.name} today`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-base ${startingId === sr.id ? 'animate-spin' : ''}`}>
                      {startingId === sr.id ? 'progress_activity' : 'play_arrow'}
                    </span>
                    <span className="hidden sm:inline">Start</span>
                  </button>
                  {/* Deleting lives inside the editor, behind a confirm —
                      not one misclick away from Start. */}
                  <button
                    onClick={() => { setEditTarget(sr); setShowEditor(true); }}
                    title="Edit saved route"
                    aria-label={`Edit ${sr.name}`}
                    className={`${ICON_BTN} hover:text-slate-700 dark:hover:text-white`}
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showEditor && (
        <SavedRouteEditor
          savedRoute={editTarget}
          zones={zones}
          defaultZoneId={zoneId || ''}
          onSuccess={() => {
            setShowEditor(false);
            showToast('success', editTarget ? 'Saved route updated.' : 'Saved route created.');
            load();
          }}
          onDeleted={() => {
            setShowEditor(false);
            showToast('success', 'Saved route deleted.');
            load();
          }}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}
