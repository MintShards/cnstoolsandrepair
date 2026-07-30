import { useState, useEffect } from 'react';
import { businessesAPI } from '../../services/api';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import { formatDateShortPacific } from '../../utils/dateFormat';
import InterestDot from './InterestDot';
import StatusLabel from './StatusLabel';

function Field({ label, children, wide = false }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-slate-900 dark:text-white break-words">{children}</p>
    </div>
  );
}

export default function BusinessProfile({
  business,
  zoneNames = [],
  isAdmin,
  onEdit,
  onLogVisit,
  onConvert,
  onDelete,
  onClose,
}) {
  const [visits, setVisits] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(true);
  const [visitsFailed, setVisitsFailed] = useState(false);
  useBodyScrollLock(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingVisits(true);
    setVisitsFailed(false);
    businessesAPI.getVisits(business.id)
      .then((data) => { if (!cancelled) setVisits(data); })
      .catch(() => { if (!cancelled) setVisitsFailed(true); })
      .finally(() => { if (!cancelled) setLoadingVisits(false); });
    return () => { cancelled = true; };
  }, [business.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const contactName = `${business.contact_first_name || ''} ${business.contact_last_name || ''}`.trim();

  return (
    /* z-40: the edit/visit/convert forms opened from here are z-50 and stack above this */
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-start justify-center p-4 pt-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-2xl mb-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="min-w-0">
            <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight break-words">
              {business.company_name}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <InterestDot level={business.interest_level} />
              <StatusLabel isCustomer={!!business.customer_id} />
              {zoneNames.map(name => (
                <span
                  key={name}
                  className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-full"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex-shrink-0"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Details */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 border-b border-slate-200 dark:border-slate-700">
          <Field label="Contact">{contactName || <span className="text-slate-400">—</span>}</Field>
          <Field label="Phone">
            {business.phone
              ? <a href={`tel:${business.phone.replace(/\D/g, '')}`} className="hover:text-primary hover:underline">{business.phone}</a>
              : <span className="text-slate-400">—</span>}
          </Field>
          <Field label="Email">
            {business.email
              ? <a href={`mailto:${business.email}`} className="hover:text-primary hover:underline break-all">{business.email}</a>
              : <span className="text-slate-400">—</span>}
          </Field>
          <Field label="Visits">
            {business.visit_count ?? 0}
            {business.last_visited_at && (
              <span className="text-slate-500 dark:text-slate-400">
                {' '}· last {formatDateShortPacific(business.last_visited_at)}
              </span>
            )}
          </Field>
          <Field label="Address" wide>
            {business.address || <span className="text-slate-400">—</span>}
          </Field>
          {business.notes && (
            <Field label="Notes" wide>
              <span className="whitespace-pre-wrap">{business.notes}</span>
            </Field>
          )}
        </div>

        {/* Visit history */}
        <div className="p-5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Visit History
          </p>
          {loadingVisits ? (
            <div className="flex justify-center py-6">
              <span className="material-symbols-outlined animate-spin text-2xl text-slate-400">progress_activity</span>
            </div>
          ) : visitsFailed ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm py-4">Could not load visit history.</p>
          ) : visits.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm py-4">No visits recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {visits.map((v) => (
                <div key={v.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {formatDateShortPacific(v.visited_at)}
                      {v.rep_name && <span className="font-normal text-slate-500 dark:text-slate-400"> · {v.rep_name}</span>}
                    </span>
                    <InterestDot level={v.interest_level} className="flex-shrink-0" />
                  </div>
                  {v.notes && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">{v.notes}</p>}
                  {v.follow_up_date && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Follow-up {v.follow_up_date}
                      {v.follow_up_note && ` — ${v.follow_up_note}`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
          {business.google_maps_link && (
            <a
              href={business.google_maps_link}
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 flex items-center gap-1.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-colors text-sm font-bold"
            >
              <span className="material-symbols-outlined text-base">navigation</span>
              Navigate
            </a>
          )}
          <button
            onClick={onLogVisit}
            className="h-10 flex items-center gap-1.5 px-4 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl transition-colors text-sm font-bold"
          >
            <span className="material-symbols-outlined text-base">edit_note</span>
            Log Visit
          </button>
          {isAdmin && (
            <>
              <button
                onClick={onEdit}
                className="h-10 flex items-center gap-1.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors text-sm font-bold"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                Edit
              </button>
              {!business.customer_id && (
                <button
                  onClick={onConvert}
                  className="h-10 flex items-center gap-1.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-green-600 dark:hover:text-green-400 rounded-xl transition-colors text-sm font-bold"
                >
                  <span className="material-symbols-outlined text-base">person_add</span>
                  Convert
                </button>
              )}
              <button
                onClick={onDelete}
                title="Delete business"
                aria-label={`Delete ${business.company_name}`}
                className="h-10 w-10 ml-auto flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-xl transition-colors"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
