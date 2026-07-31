import { useState, useEffect } from 'react';
import { savedRoutesAPI, businessesAPI } from '../../services/api';
import { useToast } from '../../pages/sales/SalesDashboard';
import ZoneOptions from './ZoneOptions';
import InterestDot from './InterestDot';
import ConfirmModal from './ConfirmModal';
import { apiErrorMessage } from '../../utils/apiError';
import useEscapeClose from '../../utils/useEscapeClose';

/**
 * Create/edit a saved route: a standing, ORDERED list of businesses under a
 * zone. No date, no rep — those belong to the run you start from it.
 * Deleting lives here too (edit mode only), behind a confirm — the list rows
 * keep only Start and Edit.
 */
export default function SavedRouteEditor({ savedRoute, zones, defaultZoneId = '', onSuccess, onDeleted, onClose }) {
  const showToast = useToast();
  const [name, setName] = useState(savedRoute?.name || '');
  // One zone control: tags the saved route and filters the picker; the search
  // still looks everywhere, same as the run planner. defaultZoneId lets a
  // zone screen open this with its own zone already picked.
  const [zoneId, setZoneId] = useState(savedRoute?.zone_id || defaultZoneId || '');
  const [searchText, setSearchText] = useState('');
  const [members, setMembers] = useState(
    savedRoute?.businesses?.map(b => ({ id: b.id, company_name: b.company_name })) || []
  );
  const [businesses, setBusinesses] = useState([]);
  const [loadingBiz, setLoadingBiz] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // While the delete confirm is up, Escape belongs to IT — without the guard
  // one keypress would close both and silently discard unsaved edits.
  useEscapeClose(() => { if (!confirmingDelete) onClose(); });

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

  const available = businesses.filter(b => !members.find(m => m.id === b.id));

  const addMember = (biz) => {
    setMembers(prev => [...prev, { id: biz.id, company_name: biz.company_name }]);
  };

  const addAll = () => {
    setMembers(prev => [...prev, ...available.map(b => ({ id: b.id, company_name: b.company_name }))]);
  };

  const removeMember = (idx) => setMembers(prev => prev.filter((_, i) => i !== idx));

  const moveMember = (idx, direction) => {
    const next = [...members];
    const target = idx + direction;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setMembers(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('error', 'Give the route a name.');
      return;
    }
    // A saved route lives inside its zone — zone-less routes would stamp
    // zone-less runs, which no zone screen's history could ever show.
    if (!zoneId) {
      showToast('error', 'Pick the zone this route belongs to.');
      return;
    }
    if (members.length === 0) {
      showToast('error', 'Add at least one business.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        zone_id: zoneId || null,
        business_ids: members.map(m => m.id),
      };
      if (savedRoute) {
        await savedRoutesAPI.update(savedRoute.id, payload);
      } else {
        await savedRoutesAPI.create(payload);
      }
      onSuccess();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to save the route.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setConfirmingDelete(false);
    setDeleting(true);
    try {
      await savedRoutesAPI.delete(savedRoute.id);
      onDeleted();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to delete the saved route.'));
      setDeleting(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full my-8 border border-slate-200/50 dark:border-slate-700/50 shadow-2xl shadow-black/10 dark:shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30" />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700/60">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary text-lg">
              {savedRoute ? 'edit' : 'bookmark_add'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">
              {savedRoute ? 'Edit Saved Route' : 'New Saved Route'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs truncate">
              Build it once — start it any day with one tap.
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Route Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                  autoFocus
                  placeholder="e.g. Mitchell Island Run"
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Zone *</label>
                <select
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                >
                  <option value="">Select zone...</option>
                  <ZoneOptions zones={zones} leafOnly />
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Business picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Add Businesses
                  </label>
                  {available.length > 1 && (
                    <button
                      type="button"
                      onClick={addAll}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Add all ({available.length})
                    </button>
                  )}
                </div>
                <div className="relative mb-2">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
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
                    ) : available.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                        {searchText.trim() ? 'No matches' : 'No businesses available'}
                      </p>
                    ) : (
                      available.map((biz) => (
                        <button
                          key={biz.id}
                          type="button"
                          onClick={() => addMember(biz)}
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

              {/* Member list, in drive order */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Businesses On Route ({members.length})
                </label>
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                  <div className="max-h-[16.5rem] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {members.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                        No businesses yet — click one to add it
                      </p>
                    ) : (
                      members.map((m, idx) => (
                        <div key={m.id} className="flex items-center gap-2.5 px-3 py-2.5">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 dark:bg-primary/20">
                            <span className="text-xs font-black text-primary">{idx + 1}</span>
                          </div>
                          <p className="text-sm font-bold flex-1 min-w-0 truncate text-slate-900 dark:text-white">
                            {m.company_name || 'Unnamed business'}
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => moveMember(idx, -1)}
                              disabled={idx === 0}
                              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                            >
                              <span className="material-symbols-outlined text-base">keyboard_arrow_up</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => moveMember(idx, 1)}
                              disabled={idx === members.length - 1}
                              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                            >
                              <span className="material-symbols-outlined text-base">keyboard_arrow_down</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeMember(idx)}
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
            {savedRoute && onDeleted && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving || deleting}
                title="Delete saved route"
                aria-label={`Delete ${savedRoute.name}`}
                className="px-4 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-red-50 dark:hover:bg-red-900/20 border border-slate-300 dark:border-slate-600/50 hover:border-red-200 dark:hover:border-red-800/50 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-base align-middle ${deleting ? 'animate-spin' : ''}`}>
                  {deleting ? 'progress_activity' : 'delete'}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="flex-1 px-4 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-900 dark:text-white rounded-xl font-bold transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || deleting}
              className="flex-1 px-4 py-2.5 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl font-bold transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : savedRoute ? 'Save Changes' : 'Create Saved Route'}
            </button>
          </div>
        </form>
      </div>
    </div>

    {/* Sibling of the overlay, NOT a descendant: backdrop-blur makes the
        overlay a containing block for fixed children, which would pin the
        confirm to the scrolled content instead of the viewport on phones. */}
    {confirmingDelete && (
      <ConfirmModal
        message={`Delete saved route "${savedRoute.name}"? Past runs made from it are untouched.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    )}
    </>
  );
}
