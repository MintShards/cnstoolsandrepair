import { useState, useEffect, useCallback } from 'react';
import { salesRepsAPI } from '../../../services/api';
import { useToast } from '../../../pages/sales/SalesDashboard';
import SortableTh from '../SortableTh';
import useSort, { sortRows } from '../useSort';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../pageSize';
import PaginationBar from '../../admin/shared/PaginationBar';
import ConfirmModal from '../ConfirmModal';
import TabHeader from '../TabHeader';
import { apiErrorMessage } from '../../../utils/apiError';
import useEscapeClose from '../../../utils/useEscapeClose';
import { ICON_BTN, BTN_PRIMARY } from '../ui';
import { formatDateShortPacific } from '../../../utils/dateFormat';

// Busiest reps first when those columns are clicked.
const FIRST_DIRS = { total_visits: 'desc', total_routes: 'desc', created_at: 'desc', is_active: 'desc' };

function RepForm({ rep, onSuccess, onClose }) {
  const showToast = useToast();
  useEscapeClose(onClose);
  const [firstName, setFirstName] = useState(rep?.first_name || '');
  const [lastName, setLastName] = useState(rep?.last_name || '');
  const [email, setEmail] = useState(rep?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (rep) {
        const payload = { first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim() };
        if (password) payload.password = password;
        await salesRepsAPI.update(rep.id, payload);
      } else {
        await salesRepsAPI.create({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          password,
        });
      }
      onSuccess();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to save rep.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {rep ? 'Edit Sales Rep' : 'Add Sales Rep'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">First Name *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Last Name *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              {rep ? 'New Password (leave blank to keep current)' : 'Password *'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!rep}
                minLength={8}
                placeholder={rep ? 'Leave blank to keep' : 'Min 8 characters'}
                className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-primary hover:bg-primary/90 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white font-black rounded-xl transition-colors uppercase text-sm"
            >
              {saving ? 'Saving...' : rep ? 'Save Changes' : 'Add Rep'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SalesRepsTab() {
  const showToast = useToast();
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmRep, setConfirmRep] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const { sortBy, sortDir, handleSort } = useSort('name', 'asc', FIRST_DIRS, () => setCurrentPage(1));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await salesRepsAPI.list();
      setReps(data);
    } catch {
      showToast('error', 'Failed to load sales reps.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const handleToggleActive = (rep) => {
    setConfirmRep(rep);
  };

  const confirmToggle = async () => {
    const rep = confirmRep;
    setConfirmRep(null);
    const action = rep.is_active ? 'deactivate' : 'activate';
    try {
      if (rep.is_active) {
        await salesRepsAPI.deactivate(rep.id);
      } else {
        await salesRepsAPI.activate(rep.id);
      }
      showToast('success', `Rep ${action}d.`);
      load();
    } catch (err) {
      showToast('error', apiErrorMessage(err, `Failed to ${action} rep.`));
    }
  };

  // The reps endpoint returns every rep, so sorting here is safe — unlike the
  // paginated lists, there's no hidden remainder to misrepresent.
  const sortedReps = sortRows(reps, sortBy, sortDir, {
    name: (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email,
    is_active: (r) => (r.is_active ? 1 : 0),
  });
  const pagedReps = sortedReps.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      {/* Header */}
      <TabHeader
        title="Sales Reps"
        subtitle="Accounts that can log visits and run routes"
        action={(
          <button
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            className={`${BTN_PRIMARY} w-full sm:w-auto flex-shrink-0`}
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            Add Rep
          </button>
        )}
      />

      {/* Table */}
      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">All Reps</span>
          <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{reps.length}</span>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-3 text-slate-500 dark:text-slate-400">Loading sales reps...</p>
          </div>
        ) : reps.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-3">badge</span>
            <p className="text-slate-500 dark:text-slate-400 font-medium">No sales reps yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base text-left">
              <thead className="text-sm uppercase text-slate-500 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60">
                <tr>
                  {[
                    { field: 'name',         label: 'Rep',    cls: 'px-3 sm:px-4' },
                    // Status folds into the rep cell on phones — its own column
                    // pushed Actions off the right edge.
                    { field: 'is_active',    label: 'Status', cls: 'px-4 hidden sm:table-cell' },
                    { field: 'total_visits', label: 'Visits', cls: 'px-4 hidden sm:table-cell' },
                    { field: 'total_routes', label: 'Routes', cls: 'px-4 hidden md:table-cell' },
                    { field: 'created_at',   label: 'Since',  cls: 'px-4 hidden xl:table-cell' },
                  ].map(col => (
                    <SortableTh key={col.field} {...col} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  ))}
                  <th className="py-3 px-2 sm:px-4 text-right font-bold">
                    <span className="sr-only sm:not-sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                {pagedReps.map((rep) => {
                  const name = `${rep.first_name || ''} ${rep.last_name || ''}`.trim() || rep.email;
                  return (
                    <tr
                      key={rep.id}
                      className={`hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors ${rep.is_active ? '' : 'opacity-60'}`}
                    >
                      {/* Narrower on mobile, and the avatar drops, so Actions stays on screen */}
                      <td className="py-3.5 px-3 sm:px-4 max-w-[150px] sm:max-w-[220px]">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-primary/10 hidden sm:flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-black text-primary uppercase">
                              {(rep.first_name?.[0] || rep.email[0]).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-slate-900 dark:text-white font-bold uppercase truncate">{name}</div>
                            <div className="text-slate-500 dark:text-slate-400 text-sm truncate">{rep.email}</div>
                            <div className="sm:hidden mt-1 text-xs font-bold">
                              <span className={rep.is_active
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-slate-400 dark:text-slate-500'}>
                                {rep.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <span className="text-slate-400 dark:text-slate-500"> · {rep.total_visits} visit{rep.total_visits !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 hidden sm:table-cell">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                          rep.is_active
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700/50'
                            : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600'
                        }`}>
                          {rep.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 text-sm hidden sm:table-cell whitespace-nowrap">
                        {rep.total_visits} visit{rep.total_visits !== 1 ? 's' : ''}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 text-sm hidden md:table-cell whitespace-nowrap">
                        {rep.total_routes} route{rep.total_routes !== 1 ? 's' : ''}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-sm hidden xl:table-cell whitespace-nowrap">
                        {formatDateShortPacific(rep.created_at)}
                      </td>
                      <td className="py-3.5 px-2 sm:px-4 text-right">
                        <div className="inline-flex items-center gap-1 sm:gap-1.5">
                          <button
                            onClick={() => { setEditTarget(rep); setShowForm(true); }}
                            title="Edit rep"
                            aria-label={`Edit ${name}`}
                            className={`${ICON_BTN} hover:text-slate-700 dark:hover:text-white`}
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={() => handleToggleActive(rep)}
                            title={rep.is_active ? 'Deactivate rep' : 'Activate rep'}
                            aria-label={`${rep.is_active ? 'Deactivate' : 'Activate'} ${name}`}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold transition-all ${
                              rep.is_active
                                ? 'hover:text-red-500 dark:hover:text-red-400'
                                : 'hover:text-green-600 dark:hover:text-green-400'
                            }`}
                          >
                            <span className="material-symbols-outlined text-base">{rep.is_active ? 'person_off' : 'person'}</span>
                            <span className="hidden xl:inline">{rep.is_active ? 'Deactivate' : 'Activate'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <PaginationBar
              currentPage={currentPage}
              totalItems={sortedReps.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          </div>
        )}
      </div>

      {showForm && (
        <RepForm
          rep={editTarget}
          onSuccess={() => { setShowForm(false); load(); showToast('success', editTarget ? 'Rep updated.' : 'Rep added.'); }}
          onClose={() => setShowForm(false)}
        />
      )}

      {confirmRep && (
        <ConfirmModal
          message={`${confirmRep.is_active ? 'Deactivate' : 'Activate'} ${`${confirmRep.first_name || ''} ${confirmRep.last_name || ''}`.trim() || confirmRep.email}?`}
          confirmLabel={confirmRep.is_active ? 'Deactivate' : 'Activate'}
          confirmClass={confirmRep.is_active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
          onConfirm={confirmToggle}
          onCancel={() => setConfirmRep(null)}
        />
      )}
    </div>
  );
}
