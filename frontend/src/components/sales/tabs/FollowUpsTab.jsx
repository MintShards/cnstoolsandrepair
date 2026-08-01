import { useState, useEffect, useCallback } from 'react';
import { visitsAPI } from '../../../services/api';
import { useToast } from '../../../pages/sales/SalesDashboard';
import VisitLogger from '../VisitLogger';
import SortableTh from '../SortableTh';
import InterestDot from '../InterestDot';
import TabHeader from '../TabHeader';
import useSort from '../useSort';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../pageSize';
import PaginationBar from '../../admin/shared/PaginationBar';
import { apiErrorMessage } from '../../../utils/apiError';
import { stopNavUrl, telHref } from '../../../utils/maps';
import { ICON_BTN } from '../ui';
import { getTodayPacific, formatDateShortPacific, formatYmd } from '../../../utils/dateFormat';

function isOverdue(dateStr) {
  if (!dateStr) return false;
  // Compare the YYYY-MM-DD strings directly against the shop's Pacific date, so a
  // rep in another timezone doesn't see today's follow-ups flagged overdue.
  return dateStr < getTodayPacific();
}

// Oldest due date first is the useful default — overdue items lead.
const FIRST_DIRS = { interest_level: 'desc', visited_at: 'desc' };

export default function FollowUpsTab() {
  const showToast = useToast();
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visitTarget, setVisitTarget] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [dismissingId, setDismissingId] = useState(null);
  const { sortBy, sortDir, handleSort } = useSort(
    'follow_up_date', 'asc', FIRST_DIRS, () => setCurrentPage(1),
  );

  const load = useCallback(async (page, size) => {
    setLoading(true);
    try {
      const { data, total: t } = await visitsAPI.getFollowUps({
        skip: (page - 1) * size, limit: size, sort_by: sortBy, sort_dir: sortDir,
      });
      setFollowUps(data);
      setTotal(t);
    } catch {
      showToast('error', 'Failed to load follow-ups.');
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortDir, showToast]);

  useEffect(() => { load(currentPage, pageSize); }, [currentPage, pageSize, sortBy, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVisitLogged = () => {
    setVisitTarget(null);
    showToast('success', 'Visit logged.');
    load(currentPage, pageSize);
  };

  // Clearing the visit's follow_up_date is what removes it from this list —
  // logging a new visit creates a separate record and leaves this one pending.
  const handleDismiss = async (visitId) => {
    setDismissingId(visitId);
    try {
      await visitsAPI.update(visitId, { follow_up_date: '' });
      showToast('success', 'Follow-up cleared.');
      load(currentPage, pageSize);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to clear the follow-up.'));
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <TabHeader
        title="Follow-ups"
        subtitle="Promised call-backs and return visits"
      />

      {/* Table */}
      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Scheduled</span>
          <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{total}</span>
        </div>

        {loading && followUps.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-3 text-slate-500 dark:text-slate-400">Loading follow-ups...</p>
          </div>
        ) : !loading && followUps.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-3">event_available</span>
            <p className="text-slate-500 dark:text-slate-400 font-medium">All caught up — no follow-ups scheduled</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base text-left">
              <thead className="text-sm uppercase text-slate-500 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60">
                <tr>
                  {/* Overdue used to be its own section; sorting and grouping don't
                      compose, so the red row tint and badge carry that signal now. */}
                  {[
                    // Due folds into the business cell on phones; as its own
                    // nowrap column it pushed Actions off the right edge.
                    { field: 'follow_up_date', label: 'Due',      cls: 'px-3 sm:px-4 hidden sm:table-cell' },
                    { field: 'business_name',  label: 'Business', cls: 'px-3 sm:px-4' },
                    { field: 'interest_level', label: 'Interest', cls: 'px-4 hidden sm:table-cell' },
                    { field: 'visited_at',     label: 'Logged',   cls: 'px-4 hidden xl:table-cell' },
                  ].map(col => (
                    <SortableTh key={col.field} {...col} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  ))}
                  <th className="py-3 px-4 font-bold hidden lg:table-cell">Note</th>
                  <th className="py-3 px-2 sm:px-4 text-right font-bold">
                    <span className="sr-only sm:not-sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                {followUps.map((v) => {
                  const overdueFU = isOverdue(v.follow_up_date);
                  return (
                    <tr
                      key={v.id}
                      className={`transition-colors ${
                        overdueFU
                          ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700/30'
                      }`}
                    >
                      <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap hidden sm:table-cell">
                        <div className={`font-bold ${overdueFU ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                          {formatYmd(v.follow_up_date)}
                        </div>
                        {overdueFU && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                            Overdue
                          </span>
                        )}
                      </td>
                      {/* Narrower on mobile so the Actions column stays on screen */}
                      <td className="py-3.5 px-3 sm:px-4 max-w-[120px] sm:max-w-[200px]">
                        {/* The date leads on phones, where its column is hidden —
                            a follow-up list is worthless without the due date. */}
                        <div className={`sm:hidden text-xs font-bold whitespace-nowrap ${overdueFU ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {formatYmd(v.follow_up_date)}
                          {overdueFU && <span className="uppercase tracking-wide"> · Overdue</span>}
                        </div>
                        <div className="text-slate-900 dark:text-white font-bold uppercase truncate">
                          {v.business_name || 'Unknown business'}
                        </div>
                        {v.rep_name && (
                          <div className="text-slate-500 dark:text-slate-400 text-sm truncate">{v.rep_name}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 hidden sm:table-cell">
                        <InterestDot level={v.interest_level} />
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-sm hidden xl:table-cell whitespace-nowrap">
                        {formatDateShortPacific(v.visited_at)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 text-sm hidden lg:table-cell max-w-[240px] truncate">
                        {v.follow_up_note || <span className="text-slate-400 dark:text-slate-600">—</span>}
                      </td>
                      <td className="py-3.5 px-2 sm:px-4 text-right">
                        <div className="inline-flex items-center gap-1 sm:gap-1.5">
                          {/* Working a follow-up IS calling or driving over — those
                              actions live on the row, not a detour away. */}
                          {v.business_phone && (
                            <a
                              href={telHref(v.business_phone)}
                              title={`Call ${v.business_phone}`}
                              aria-label={`Call ${v.business_name || 'business'}`}
                              className={`${ICON_BTN} hover:text-slate-700 dark:hover:text-white`}
                            >
                              <span className="material-symbols-outlined text-base">call</span>
                            </a>
                          )}
                          {v.business_maps_link && (
                            <a
                              href={stopNavUrl({
                                google_maps_link: v.business_maps_link,
                                address: v.business_address,
                                company_name: v.business_name,
                              })}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Navigate to ${v.business_name || 'business'}`}
                              aria-label={`Navigate to ${v.business_name || 'business'}`}
                              className={`${ICON_BTN} hover:text-blue-600 dark:hover:text-blue-400`}
                            >
                              <span className="material-symbols-outlined text-base">navigation</span>
                            </a>
                          )}
                          <button
                            onClick={() => setVisitTarget({ businessId: v.business_id, businessName: v.business_name, initialInterest: v.interest_level })}
                            title="Log a visit to this business"
                            className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 hover:text-primary rounded-lg text-sm font-bold transition-all"
                          >
                            <span className="material-symbols-outlined text-base">edit_note</span>
                            <span className="hidden xl:inline">Log Visit</span>
                          </button>
                          <button
                            onClick={() => handleDismiss(v.id)}
                            disabled={dismissingId === v.id}
                            title="Clear this follow-up"
                            className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                          >
                            <span className={`material-symbols-outlined text-base ${dismissingId === v.id ? 'animate-spin' : ''}`}>
                              {dismissingId === v.id ? 'progress_activity' : 'check'}
                            </span>
                            <span className="hidden xl:inline">Clear</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <PaginationBar
          currentPage={currentPage}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      </div>

      {visitTarget && (
        <VisitLogger
          {...visitTarget}
          onSuccess={handleVisitLogged}
          onClose={() => setVisitTarget(null)}
        />
      )}
    </div>
  );
}
