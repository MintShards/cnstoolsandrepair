import { useState, useEffect, useCallback, Fragment } from 'react';
import { zonesAPI } from '../../../services/api';
import { useToast } from '../../../pages/sales/SalesDashboard';
import SavedRoutesSection from '../SavedRoutesSection';
import ConfirmModal from '../ConfirmModal';
import SortableTh from '../SortableTh';
import CoverageBar from '../CoverageBar';
import useSort, { sortRows } from '../useSort';
import { groupZones, eligibleParents } from '../zoneTree';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../pageSize';
import PaginationBar from '../../admin/shared/PaginationBar';
import { apiErrorMessage } from '../../../utils/apiError';
import useEscapeClose from '../../../utils/useEscapeClose';
import { ICON_BTN } from '../ui';

// Direction each column uses on first click — the useful one, not always asc.
const ZONE_FIRST_DIRS = {
  business_count: 'desc',
  coverage_pct: 'asc',      // worst-covered first
};


/** One row in the zones table. Children render indented under their parent. */
function ZoneRow({ zone, nested = false, isAdmin = false, onOpen, onEdit, onDelete }) {
  const total = zone.business_count ?? 0;
  return (
    <tr
      onClick={() => onOpen(zone)}
      className="hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group"
    >
      <td className="py-3.5 px-3 sm:px-4">
        <div className={`flex items-center gap-2 ${nested ? 'pl-5' : ''}`}>
          {nested && (
            <span aria-hidden="true" className="material-symbols-outlined text-base text-slate-300 dark:text-slate-600">
              subdirectory_arrow_right
            </span>
          )}
          <span className={`uppercase ${nested
            ? 'text-slate-700 dark:text-slate-200 font-bold'
            : 'text-slate-900 dark:text-white font-black'}`}>
            {zone.name}
          </span>
          {zone.child_count > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 whitespace-nowrap">
              {zone.child_count} inside
            </span>
          )}
        </div>
        {/* Coverage is the point of this table — keep a compact bar on phones
            where its column is hidden. */}
        <div className={`sm:hidden mt-1.5 ${nested ? 'pl-5' : ''}`}>
          <CoverageBar
            pct={zone.coverage_pct}
            covered={zone.covered_count}
            total={total}
            windowDays={zone.coverage_window_days}
          />
        </div>
      </td>
      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 text-sm whitespace-nowrap">
        {total} business{total !== 1 ? 'es' : ''}
        {/* Without this, a parent's total looks unrelated to its children's */}
        {zone.child_count > 0 && zone.direct_business_count > 0 && (
          <div className="text-xs text-slate-400 dark:text-slate-500">
            {zone.direct_business_count} directly in this zone
          </div>
        )}
      </td>
      <td className="py-3.5 px-4 hidden sm:table-cell">
        <CoverageBar
          pct={zone.coverage_pct}
          covered={zone.covered_count}
          total={total}
          windowDays={zone.coverage_window_days}
        />
      </td>
      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-sm hidden xl:table-cell max-w-[240px] truncate">
        {zone.description || <span className="text-slate-400 dark:text-slate-600">—</span>}
      </td>
      {isAdmin && (
        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="inline-flex items-center gap-1.5">
            <button
              onClick={() => onEdit(zone)}
              title="Edit zone"
              aria-label={`Edit ${zone.name}`}
              className={`${ICON_BTN} hover:text-slate-700 dark:hover:text-white`}
            >
              <span className="material-symbols-outlined text-base">edit</span>
            </button>
            <button
              onClick={() => onDelete(zone)}
              title="Delete zone"
              aria-label={`Delete ${zone.name}`}
              className={`${ICON_BTN} hover:text-red-500 dark:hover:text-red-400`}
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}


function ZoneForm({ zone, allZones = [], onSuccess, onClose }) {
  const showToast = useToast();
  useEscapeClose(onClose);
  const [name, setName] = useState(zone?.name || '');
  const [description, setDescription] = useState(zone?.description || '');
  const [parentId, setParentId] = useState(zone?.parent_id || '');
  const [saving, setSaving] = useState(false);

  // A zone that already holds children can't itself be moved inside another —
  // disable rather than let the user submit and eat a 400.
  const hasChildren = (zone?.child_count ?? 0) > 0;
  const parents = eligibleParents(allZones, zone?.id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      // Empty string (not undefined) so clearing the description actually
      // persists; parent_id null is what promotes a child back to top-level.
      const payload = {
        name: name.trim(),
        description: description.trim(),
        parent_id: parentId || null,
      };
      if (zone) {
        await zonesAPI.update(zone.id, payload);
      } else {
        await zonesAPI.create(payload);
      }
      onSuccess();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to save zone.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30" />
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700/60">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary text-lg">
              {zone ? 'edit' : 'add_location_alt'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">
              {zone ? 'Edit Zone' : 'Add Zone'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs truncate">
              {zone ? zone.name : 'A geographic grouping for businesses and routes.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all flex-shrink-0"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Zone Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Surrey Industrial"
              required
              autoFocus
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Inside
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              disabled={hasChildren}
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
            >
              <option value="">Top-level zone</option>
              {parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
              {hasChildren
                ? `${zone.name} has zones inside it, so it can't sit inside another. Move those out first.`
                : 'Zones nest one level deep.'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-3 bg-primary hover:bg-primary/90 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white font-black rounded-xl transition-colors uppercase text-sm"
            >
              {saving ? 'Saving...' : zone ? 'Save Changes' : 'Add Zone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


/**
 * One thin screen for any zone, parent or leaf: coverage, the zone's saved
 * routes, and a jump to the Businesses tab pre-filtered to this zone. The
 * children table only appears when the zone has zones inside it. Nothing here
 * mutates zone stats — business CRUD lives on the Businesses tab.
 */
function ZoneScreen({ zone, allZones, parentZone, onBack, onOpenChild, onCrumb }) {
  const children = allZones.filter(z => z.parent_id === zone.id);
  return (
    <div>
      {/* Header. One breadcrumb trail of ANCESTORS (each clickable), then the
          zone name as the single dominant title — nothing below outranks it. */}
      <div className="mb-5">
        <div className="flex items-center gap-2.5 mb-3">
          <button
            onClick={onBack}
            title="Back"
            aria-label="Back"
            className={ICON_BTN}
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
          </button>
          <nav className="flex items-center gap-1.5 text-sm min-w-0">
            <button
              onClick={() => onCrumb(null)}
              className="font-bold text-slate-400 dark:text-slate-500 hover:text-primary transition-colors"
            >
              Zones
            </button>
            {parentZone && (
              <>
                <span className="material-symbols-outlined text-sm text-slate-400 dark:text-slate-600">chevron_right</span>
                <button
                  onClick={() => onCrumb(parentZone)}
                  className="font-bold text-slate-400 dark:text-slate-500 hover:text-primary transition-colors truncate"
                >
                  {parentZone.name}
                </button>
              </>
            )}
          </nav>
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
          {zone.name}
        </h2>
        {zone.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{zone.description}</p>
        )}

        <div className="mt-3 max-w-xs">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
            Coverage · last {zone.coverage_window_days ?? 90} days
          </p>
          <CoverageBar
            pct={zone.coverage_pct}
            covered={zone.covered_count}
            total={zone.business_count}
            windowDays={zone.coverage_window_days}
          />
        </div>
      </div>

      {/* Zones inside (parents only) */}
      {children.length > 0 && (
        <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden mb-4">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Zones inside</span>
            <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
              {children.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-base text-left">
              <thead className="text-sm uppercase text-slate-500 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60">
                <tr>
                  <th className="py-3 px-4 font-bold">Zone</th>
                  <th className="py-3 px-4 font-bold">Businesses</th>
                  <th className="py-3 px-4 font-bold hidden sm:table-cell">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                {children.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => onOpenChild(c)}
                    className="hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 text-slate-900 dark:text-white font-bold uppercase">{c.name}</td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 text-sm whitespace-nowrap">
                      {c.business_count ?? 0} business{c.business_count !== 1 ? 'es' : ''}
                    </td>
                    <td className="py-3.5 px-4 hidden sm:table-cell">
                      <CoverageBar pct={c.coverage_pct} covered={c.covered_count}
                        total={c.business_count} windowDays={c.coverage_window_days} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Saved routes live INSIDE subzones — a parent screen just points at
          its children, each of which owns its own routes. */}
      {children.length === 0 && (
        <SavedRoutesSection zoneId={zone.id} zones={allZones} />
      )}
    </div>
  );
}


export default function ZonesTab({ currentUser }) {
  const showToast = useToast();
  const isAdmin = currentUser?.role === 'admin';
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmZone, setConfirmZone] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [zonePage, setZonePage] = useState(1);
  const [zonePageSize, setZonePageSize] = useState(DEFAULT_PAGE_SIZE);
  // Remembered so "back" from a child returns to its parent, not the root list.
  const [selectedParent, setSelectedParent] = useState(null);
  const zoneSort = useSort('name', 'asc', ZONE_FIRST_DIRS, () => setZonePage(1));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await zonesAPI.list();
      setZones(data);
      // Keep selectedZone in sync if it's open
      if (selectedZone) {
        const updated = data.find(z => z.id === selectedZone.id);
        if (updated) setSelectedZone(updated);
      }
    } catch {
      showToast('error', 'Failed to load zones.');
    } finally {
      setLoading(false);
    }
  }, [showToast, selectedZone]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmDelete = async () => {
    const zone = confirmZone;
    setConfirmZone(null);
    try {
      await zonesAPI.delete(zone.id);
      showToast('success', 'Zone deleted.');
      load();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to delete zone.'));
    }
  };

  // Sorting and paging operate on FAMILIES, not rows: children render nested
  // under their parent, so a page slice can never separate the two. Safe to do
  // client-side because the endpoint returns every zone in one response.
  const term = search.trim().toLowerCase();
  const matches = (z) => !term || z.name.toLowerCase().includes(term);
  const families = groupZones(zones)
    // A search must surface a parent whose CHILD matches, or typing a child's
    // name would return nothing at all.
    .map(f => ({ ...f, children: term ? f.children.filter(matches) : f.children }))
    .filter(f => matches(f.parent) || f.children.length > 0);

  const sortedParents = sortRows(
    families.map(f => f.parent),
    zoneSort.sortBy,
    zoneSort.sortDir,
  );
  const childrenOf = new Map(families.map(f => [f.parent.id, f.children]));
  const pagedParents = sortedParents.slice((zonePage - 1) * zonePageSize, zonePage * zonePageSize);

  // Drill-down: one thin screen for parent and leaf alike.
  if (selectedZone) {
    return (
      <ZoneScreen
        zone={selectedZone}
        allZones={zones}
        parentZone={selectedParent}
        onBack={() => {
          if (selectedParent) { setSelectedZone(selectedParent); setSelectedParent(null); }
          else setSelectedZone(null);
        }}
        onOpenChild={(child) => { setSelectedParent(selectedZone); setSelectedZone(child); }}
        onCrumb={(target) => {
          // null → root list; a parent zone → that parent's screen.
          setSelectedZone(target);
          setSelectedParent(null);
        }}
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Zones</h2>
          <p className="text-xs text-slate-500 mt-0.5">Geographic groupings for route planning</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl text-sm font-bold transition-all"
          >
            <span className="material-symbols-outlined text-sm">add_location_alt</span>
            <span className="hidden sm:inline">Add Zone</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-lg">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search zones..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-all"
          />
        </div>
        {search && (
          <button
            onClick={() => setSearch('')}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">All Zones</span>
          <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{zones.length}</span>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-3 text-slate-500 dark:text-slate-400">Loading zones...</p>
          </div>
        ) : sortedParents.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-3">map</span>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              {search ? 'No zones match your search' : 'No zones yet — add your first to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base text-left">
              <thead className="text-sm uppercase text-slate-500 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60">
                <tr>
                  <SortableTh field="name" label="Zone" cls="px-3 sm:px-4"
                    sortBy={zoneSort.sortBy} sortDir={zoneSort.sortDir} onSort={zoneSort.handleSort} />
                  <SortableTh field="business_count" label="Businesses" cls="px-4"
                    sortBy={zoneSort.sortBy} sortDir={zoneSort.sortDir} onSort={zoneSort.handleSort} />
                  <SortableTh field="coverage_pct" label="Coverage" cls="px-4 hidden sm:table-cell"
                    sortBy={zoneSort.sortBy} sortDir={zoneSort.sortDir} onSort={zoneSort.handleSort} />
                  <th className="py-3 px-4 font-bold hidden xl:table-cell">Description</th>
                  {isAdmin && <th className="py-3 px-4 text-right font-bold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                {pagedParents.map((zone) => (
                  <Fragment key={zone.id}>
                    <ZoneRow
                      zone={zone}
                      isAdmin={isAdmin}
                      onOpen={setSelectedZone}
                      onEdit={(z) => { setEditTarget(z); setShowForm(true); }}
                      onDelete={setConfirmZone}
                    />
                    {(childrenOf.get(zone.id) || []).map(child => (
                      <ZoneRow
                        key={child.id}
                        zone={child}
                        nested
                        isAdmin={isAdmin}
                        onOpen={(z) => { setSelectedParent(zone); setSelectedZone(z); }}
                        onEdit={(z) => { setEditTarget(z); setShowForm(true); }}
                        onDelete={setConfirmZone}
                      />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <PaginationBar
              currentPage={zonePage}
              totalItems={sortedParents.length}
              pageSize={zonePageSize}
              onPageChange={setZonePage}
              onPageSizeChange={(size) => { setZonePageSize(size); setZonePage(1); }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              itemLabel="top-level zones"
            />
          </div>
        )}
      </div>

      {showForm && (
        <ZoneForm
          zone={editTarget}
          allZones={zones}
          onSuccess={() => { setShowForm(false); load(); showToast('success', editTarget ? 'Zone updated.' : 'Zone added.'); }}
          onClose={() => setShowForm(false)}
        />
      )}

      {confirmZone && (
        <ConfirmModal
          message={`Delete zone "${confirmZone.name}"? This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmZone(null)}
        />
      )}
    </div>
  );
}
