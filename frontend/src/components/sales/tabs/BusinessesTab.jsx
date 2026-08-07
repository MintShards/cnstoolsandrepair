import { useState, useEffect, useCallback, useRef } from 'react';
import { businessesAPI, zonesAPI } from '../../../services/api';
import { useToast } from '../../../pages/sales/SalesDashboard';
import BusinessForm from '../BusinessForm';
import VisitLogger from '../VisitLogger';
import ConvertToCustomerForm from '../ConvertToCustomerForm';
import BusinessProfile from '../BusinessProfile';
import StatusLabel from '../StatusLabel';
import ConfirmModal from '../ConfirmModal';
import SortableTh from '../SortableTh';
import ZoneOptions from '../ZoneOptions';
import InterestDot from '../InterestDot';
import TabHeader from '../TabHeader';
import { ICON_BTN, BTN_PRIMARY, FILTER_INPUT, FILTER_CLEAR } from '../ui';
import useSort from '../useSort';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../pageSize';
import PaginationBar from '../../admin/shared/PaginationBar';
import { apiErrorMessage } from '../../../utils/apiError';
import { telHref } from '../../../utils/maps';
import { formatDateShortPacific, formatAge, daysSince } from '../../../utils/dateFormat';

// A prospect untouched this long is the thing a rep needs to spot in the list.
const STALE_AFTER_DAYS = 90;

// Direction each column uses on first click — the useful one, not always asc.
const FIRST_DIRS = { interest_level: 'desc', last_visited_at: 'asc' };



export default function BusinessesTab({ currentUser, initialZoneFilter = '' }) {
  const showToast = useToast();
  const isAdmin = currentUser?.role === 'admin';
  const [businesses, setBusinesses] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Seeded from ?zone=<id> — the zone screen's "View businesses" deep link.
  const [filterZone, setFilterZone] = useState(initialZoneFilter);
  const [filterInterest, setFilterInterest] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [visitTarget, setVisitTarget] = useState(null);
  const [convertTarget, setConvertTarget] = useState(null);
  const [profileTarget, setProfileTarget] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const { sortBy, sortDir, handleSort } = useSort(
    'company_name', 'asc', FIRST_DIRS, () => setCurrentPage(1),
  );
  const searchTimeout = useRef(null);
  const isMounted = useRef(false);
  const firstLoad = useRef(true);

  const load = useCallback(async (page, size) => {
    setLoading(true);
    try {
      const params = { skip: (page - 1) * size, limit: size, sort_by: sortBy, sort_dir: sortDir };
      if (search) params.search = search;
      if (filterZone) params.zone_id = filterZone;
      if (filterInterest) params.interest_level = filterInterest;
      const { data, total: t } = await businessesAPI.list(params);
      setBusinesses(data);
      setTotal(t);
    } catch {
      showToast('error', 'Failed to load businesses.');
    } finally {
      setLoading(false);
    }
  }, [search, filterZone, filterInterest, sortBy, sortDir, showToast]);

  useEffect(() => {
    zonesAPI.list().then(setZones).catch(() => {});
  }, []);

  useEffect(() => {
    // Debounce typing, but don't make the initial paint wait on the timer.
    const delay = firstLoad.current ? 0 : 300;
    firstLoad.current = false;
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setCurrentPage(1); load(1, pageSize); }, delay);
    return () => clearTimeout(searchTimeout.current);
  }, [search, filterZone, filterInterest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    load(currentPage, pageSize);
  }, [currentPage, pageSize, sortBy, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = (id) => {
    setConfirmId(id);
  };

  // Keeps an open profile dialog in sync after an edit, visit, or conversion.
  const refreshProfile = () => {
    if (!profileTarget) return;
    businessesAPI.get(profileTarget.id).then(setProfileTarget).catch(() => setProfileTarget(null));
  };

  const confirmDelete = async () => {
    const id = confirmId;
    setConfirmId(null);
    try {
      await businessesAPI.delete(id);
      showToast('success', 'Business deleted.');
      if (profileTarget?.id === id) setProfileTarget(null);
      load(currentPage, pageSize);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to delete business.'));
    }
  };

  const handleVisitLogged = () => {
    setVisitTarget(null);
    showToast('success', 'Visit logged.');
    refreshProfile();
    load(currentPage, pageSize);
  };

  const handleConverted = () => {
    setConvertTarget(null);
    showToast('success', 'Business converted to customer.');
    refreshProfile();
    load(currentPage, pageSize);
  };

  return (
    <div>
      <TabHeader
        title="Businesses"
        subtitle="Prospects and their visit history"
        action={isAdmin && (
          <button
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            className={`${BTN_PRIMARY} w-full sm:w-auto flex-shrink-0`}
          >
            <span className="material-symbols-outlined text-sm">add_business</span>
            Add Business
          </button>
        )}
      >
        <div className="relative w-full sm:flex-1 sm:min-w-[12rem] sm:max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-lg">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company name..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-all"
          />
        </div>
        <select
          value={filterZone}
          onChange={(e) => setFilterZone(e.target.value)}
          className={FILTER_INPUT}
        >
          <option value="">All Zones</option>
          <ZoneOptions zones={zones} />
        </select>
        <select
          value={filterInterest}
          onChange={(e) => setFilterInterest(e.target.value)}
          className={FILTER_INPUT}
        >
          <option value="">All Interest</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>
        {(search || filterZone || filterInterest) && (
          <button
            onClick={() => { setSearch(''); setFilterZone(''); setFilterInterest(''); }}
            className={FILTER_CLEAR}
          >
            <span className="material-symbols-outlined text-sm">close</span>
            Clear
          </button>
        )}
      </TabHeader>

      {/* Table */}
      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">All Businesses</span>
            <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{total}</span>
          </div>
        </div>

        {loading && businesses.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-3 text-slate-500 dark:text-slate-400">Loading businesses...</p>
          </div>
        ) : businesses.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-3">storefront</span>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              {search || filterZone || filterInterest ? 'No businesses match your filters' : 'No businesses yet'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-base text-left">
                <thead className="text-sm uppercase text-slate-500 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60">
                  <tr>
                    {/* Recency is the signal that drives who to visit next, so it
                        survives longer than phone/zone as the viewport narrows. */}
                    {[
                      { field: 'company_name',    label: 'Company / Contact', cls: 'px-3 sm:px-4' },
                      { field: 'interest_level',  label: 'Interest',   cls: 'px-4 hidden sm:table-cell' },
                      { field: 'status',          label: 'Status',     cls: 'px-4 hidden sm:table-cell' },
                      { field: 'last_visited_at', label: 'Last Visit', cls: 'px-4 hidden sm:table-cell' },
                    ].map(col => (
                      <SortableTh key={col.field} {...col} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    ))}
                    {/* Phone has no meaningful order worth sorting on */}
                    <th className="py-3 px-4 font-bold hidden lg:table-cell">Phone</th>
                    <SortableTh
                      field="zone_name" label="Zone" cls="px-4 hidden xl:table-cell"
                      sortBy={sortBy} sortDir={sortDir} onSort={handleSort}
                    />
                    <th className="py-3 px-2 sm:px-4 text-right font-bold">
                      <span className="sr-only sm:not-sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                  {businesses.map((biz) => {
                    const contactName = `${biz.contact_first_name || ''} ${biz.contact_last_name || ''}`.trim();
                    // Falls back to the locally-loaded zone list if the join is missing.
                    const zoneNames = biz.zone_names?.length
                      ? biz.zone_names
                      : (biz.zone_ids || []).map(id => zones.find(z => z.id === id)?.name).filter(Boolean);
                    const dash = <span className="text-slate-400 dark:text-slate-600">—</span>;
                    const age = daysSince(biz.last_visited_at);
                    const isStale = age !== null && age >= STALE_AFTER_DAYS;
                    return (
                      <tr
                        key={biz.id}
                        onClick={() => setProfileTarget(biz)}
                        className="hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-3 sm:px-4 max-w-[150px] sm:max-w-[200px] lg:max-w-[260px]">
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Interest has no column on mobile, so carry it as a dot */}
                            <InterestDot level={biz.interest_level} withLabel={false} className="sm:hidden flex-shrink-0" />
                            {/* Sibling names differ at the tail (Ashcroft X,
                                Ashcroft Y) — wrap on phones instead of cutting
                                off the one distinguishing word. */}
                            <span className="text-slate-900 dark:text-white font-bold uppercase min-w-0 break-words sm:truncate">{biz.company_name}</span>
                            {/* Status has no column on mobile, so flag customers inline */}
                            {biz.customer_id && (
                              <StatusLabel isCustomer className="sm:hidden flex-shrink-0" />
                            )}
                          </div>
                          {contactName && (
                            <div className="text-slate-500 dark:text-slate-400 text-sm mt-0.5 uppercase truncate">{contactName}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 hidden sm:table-cell">
                          <InterestDot level={biz.interest_level} />
                        </td>
                        <td className="py-3.5 px-4 hidden sm:table-cell">
                          <StatusLabel isCustomer={!!biz.customer_id} />
                        </td>
                        <td className="py-3.5 px-4 text-sm hidden sm:table-cell whitespace-nowrap">
                          {biz.last_visited_at ? (
                            <>
                              <div className={isStale ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'}>
                                {formatAge(biz.last_visited_at)}
                              </div>
                              <div className="text-xs text-slate-400 dark:text-slate-500">
                                {formatDateShortPacific(biz.last_visited_at)} · {biz.visit_count ?? 0} visit{biz.visit_count !== 1 ? 's' : ''}
                              </div>
                            </>
                          ) : (
                            // The default state of a fresh prospect — quiet text.
                            // Amber stays reserved for gone-stale visits, which are rare.
                            <span className="text-slate-400 dark:text-slate-500">Never visited</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 text-sm hidden lg:table-cell">
                          {biz.phone
                            ? <a href={telHref(biz.phone)} onClick={(e) => e.stopPropagation()} className="hover:text-primary hover:underline">{biz.phone}</a>
                            : dash}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 text-sm hidden xl:table-cell whitespace-nowrap">
                          {zoneNames.length === 0 ? dash : (
                            <>
                              {zoneNames[0]}
                              {zoneNames.length > 1 && (
                                <span
                                  title={zoneNames.join(', ')}
                                  className="ml-1.5 text-xs font-bold text-slate-400 dark:text-slate-500"
                                >
                                  +{zoneNames.length - 1}
                                </span>
                              )}
                            </>
                          )}
                        </td>
                        <td className="py-3.5 px-2 sm:px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1.5">
                            {biz.google_maps_link && (
                              <a
                                href={biz.google_maps_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Directions to ${biz.company_name}`}
                                aria-label={`Directions to ${biz.company_name}`}
                                className={`${ICON_BTN} hover:text-blue-600 dark:hover:text-blue-400`}
                              >
                                <span className="material-symbols-outlined text-base">navigation</span>
                              </a>
                            )}
                            <button
                              onClick={() => setVisitTarget({ businessId: biz.id, businessName: biz.company_name, initialInterest: biz.interest_level })}
                              title="Log a visit to this business"
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 hover:text-primary rounded-lg text-sm font-bold transition-all"
                            >
                              <span className="material-symbols-outlined text-base">edit_note</span>
                              <span className="hidden xl:inline">Log Visit</span>
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

      {/* Business Form Modal */}
      {showForm && (
        <BusinessForm
          business={editTarget}
          zones={zones}
          onSuccess={() => { setShowForm(false); refreshProfile(); load(currentPage, pageSize); showToast('success', editTarget ? 'Business updated.' : 'Business added.'); }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Visit Logger Modal */}
      {visitTarget && (
        <VisitLogger
          {...visitTarget}
          onSuccess={handleVisitLogged}
          onClose={() => setVisitTarget(null)}
        />
      )}

      {/* Convert to Customer Modal */}
      {convertTarget && (
        <ConvertToCustomerForm
          business={convertTarget}
          onSuccess={handleConverted}
          onClose={() => setConvertTarget(null)}
        />
      )}

      {confirmId && (
        <ConfirmModal
          message="Delete this business? This cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* Business Profile Dialog */}
      {profileTarget && (
        <BusinessProfile
          business={profileTarget}
          zoneNames={profileTarget.zone_names?.length
            ? profileTarget.zone_names
            : (profileTarget.zone_ids || []).map(id => zones.find(z => z.id === id)?.name).filter(Boolean)}
          isAdmin={isAdmin}
          onLogVisit={() => setVisitTarget({ businessId: profileTarget.id, businessName: profileTarget.company_name, initialInterest: profileTarget.interest_level })}
          onEdit={() => { setEditTarget(profileTarget); setShowForm(true); }}
          onConvert={() => setConvertTarget(profileTarget)}
          onDelete={() => handleDelete(profileTarget.id)}
          onClose={() => setProfileTarget(null)}
        />
      )}
    </div>
  );
}
