import { useState, useEffect } from 'react';
import { routesAPI, businessesAPI } from '../../services/api';
import { useToast } from '../../pages/sales/SalesDashboard';
import ZoneOptions from './ZoneOptions';
import InterestDot from './InterestDot';
import { apiErrorMessage } from '../../utils/apiError';
import useEscapeClose from '../../utils/useEscapeClose';

/**
 * Edit an existing run (a dated route). Runs are CREATED by starting a saved
 * route — this modal only adjusts one: stops, order, date, assignee.
 */
export default function RoutePlanner({ route, reps, zones, currentUser, onSuccess, onClose }) {
  const showToast = useToast();
  const isAdmin = currentUser?.role === 'admin';

  const [name, setName] = useState(route?.name || '');
  const [date, setDate] = useState(route?.date || '');
  const [assignedTo, setAssignedTo] = useState(route?.assigned_to || currentUser?.id || '');
  // ONE zone control: it tags the route and filters the picker. Stops from
  // another zone are still reachable — the search below looks everywhere.
  const [zoneId, setZoneId] = useState(route?.zone_id || '');
  const [searchText, setSearchText] = useState('');
  const [stops, setStops] = useState(
    route?.stops?.map(s => ({
      business_id: s.business_id,
      company_name: s.company_name,
      completed: s.completed || false,
      completed_at: s.completed_at || null,
    })) || []
  );
  const [businesses, setBusinesses] = useState([]);
  const [loadingBiz, setLoadingBiz] = useState(false);
  const [saving, setSaving] = useState(false);
  useEscapeClose(onClose);

  // Typing searches ALL businesses (ignoring the zone); an empty box shows the
  // zone's businesses.
  useEffect(() => {
    setLoadingBiz(true);
    const q = searchText.trim();
    const params = { limit: 100 };
    if (q) params.search = q;
    else if (zoneId) params.zone_id = zoneId;
    const t = setTimeout(() => {
      businessesAPI.list(params)
        .then(({ data }) => setBusinesses(data))
        .catch(() => {})
        .finally(() => setLoadingBiz(false));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [zoneId, searchText]);

  const addStop = (biz) => {
    if (stops.find(s => s.business_id === biz.id)) return;
    setStops(prev => [...prev, {
      business_id: biz.id,
      company_name: biz.company_name,
      completed: false,
      completed_at: null,
    }]);
  };

  const availableBiz = businesses.filter(b => !stops.find(s => s.business_id === b.id));

  const addAll = () => {
    setStops(prev => [
      ...prev,
      ...availableBiz.map(b => ({
        business_id: b.id,
        company_name: b.company_name,
        completed: false,
        completed_at: null,
      })),
    ]);
  };

  const removeStop = (idx) => setStops(prev => prev.filter((_, i) => i !== idx));

  const moveStop = (idx, direction) => {
    const newStops = [...stops];
    const target = idx + direction;
    if (target < 0 || target >= newStops.length) return;
    [newStops[idx], newStops[target]] = [newStops[target], newStops[idx]];
    setStops(newStops);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !assignedTo) {
      showToast('error', 'Date and assigned rep are required.');
      return;
    }
    if (stops.length === 0) {
      showToast('error', 'Add at least one stop to the route.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        date,
        assigned_to: assignedTo,
        zone_id: zoneId || null,
        // Carry completion through: the backend replaces the whole stops array,
        // so omitting these would reset the rep's finished stops to pending.
        stops: stops.map((s, i) => ({
          business_id: s.business_id,
          order: i,
          completed: s.completed,
          completed_at: s.completed_at,
        })),
      };
      await routesAPI.update(route.id, payload);
      onSuccess();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to save route.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full my-8 border border-slate-200/50 dark:border-slate-700/50 shadow-2xl shadow-black/10 dark:shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30" />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700/60">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary text-lg">edit</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">Edit Route</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs truncate">
              Reorder, add, or remove stops.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all flex-shrink-0"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 sm:p-6 space-y-4">
            {/* Route meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Zone</label>
                <select
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                >
                  <option value="">No zone</option>
                  <ZoneOptions zones={zones} />
                </select>
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Assign To *</label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                  >
                    <option value="">Select rep...</option>
                    {reps.map(r => (
                      <option key={r.id} value={r.id}>
                        {`${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                  Route Name <span className="normal-case font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Surrey Run"
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Business picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Add Stops
                  </label>
                  {availableBiz.length > 1 && (
                    <button
                      type="button"
                      onClick={addAll}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Add all ({availableBiz.length})
                    </button>
                  )}
                </div>
                <div className="relative mb-2">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    autoFocus
                    placeholder="Search all businesses..."
                    className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                  />
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {loadingBiz ? (
                      <div className="flex justify-center py-6">
                        <span className="material-symbols-outlined animate-spin text-xl text-slate-400">progress_activity</span>
                      </div>
                    ) : availableBiz.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                        {searchText.trim() ? 'No matches' : 'No businesses available'}
                      </p>
                    ) : (
                      availableBiz.map((biz) => (
                        <button
                          key={biz.id}
                          type="button"
                          onClick={() => addStop(biz)}
                          className="w-full text-left px-3 py-2.5 hover:bg-white dark:hover:bg-slate-800 transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{biz.company_name}</p>
                            <InterestDot level={biz.interest_level} className="mt-0.5" />
                          </div>
                          <span className="material-symbols-outlined text-slate-400 text-lg flex-shrink-0">add_circle</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Stops list */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Route Stops ({stops.length})
                </label>
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                  <div className="max-h-[17.5rem] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {stops.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                        No stops yet — click a business to add it
                      </p>
                    ) : (
                      stops.map((stop, idx) => (
                        <div key={stop.business_id} className="flex items-center gap-2.5 px-3 py-2.5">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            stop.completed
                              ? 'bg-green-100 dark:bg-green-900/30'
                              : 'bg-primary/10 dark:bg-primary/20'
                          }`}>
                            {stop.completed ? (
                              <span className="material-symbols-outlined text-sm text-green-600 dark:text-green-400">check</span>
                            ) : (
                              <span className="text-xs font-black text-primary">{idx + 1}</span>
                            )}
                          </div>
                          <p className={`text-sm font-bold flex-1 min-w-0 truncate ${
                            stop.completed
                              ? 'text-slate-400 dark:text-slate-500 line-through'
                              : 'text-slate-900 dark:text-white'
                          }`}>
                            {stop.company_name || 'Unnamed business'}
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => moveStop(idx, -1)}
                              disabled={idx === 0}
                              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                            >
                              <span className="material-symbols-outlined text-base">keyboard_arrow_up</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => moveStop(idx, 1)}
                              disabled={idx === stops.length - 1}
                              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                            >
                              <span className="material-symbols-outlined text-base">keyboard_arrow_down</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeStop(idx)}
                              className="p-0.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-1"
                            >
                              <span className="material-symbols-outlined text-base">remove_circle</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 pb-6">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-900 dark:text-white rounded-xl font-bold transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl font-bold transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
