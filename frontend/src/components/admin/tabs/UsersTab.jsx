import { useState, useEffect, useCallback } from 'react';
import { authAPI, staffAPI, salesRepsAPI } from '../../../services/api';
import { ToastProvider, useToast } from '../shared/ToastProvider';
import { apiErrorMessage } from '../../../utils/apiError';
import TabHeader from '../../sales/TabHeader';
import { BTN_PRIMARY } from '../../sales/ui';
import PaginationBar from '../shared/PaginationBar';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../sales/pageSize';
import { INPUT_CLS, LABEL_CLS, CANCEL_BTN_CLS, SUBMIT_BTN_CLS } from '../../workspace/formStyles';
import { formatDateShortPacific } from '../../../utils/dateFormat';
import useEscapeClose from '../../../utils/useEscapeClose';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import StaffAvatar from '../../workspace/StaffAvatar';
import ConfirmModal from '../../sales/ConfirmModal';

/**
 * Every login in ONE table — admins, staff, technicians and sales reps.
 * Two backends still power it (shop accounts vs sales reps), so each row
 * carries `kind` and the handlers route by it; the person managing accounts
 * never has to care which is which.
 */

const ROLES = {
  admin: {
    label: 'Admin', rank: 0,
    badge: 'bg-purple-100 text-purple-800 border-purple-400 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-600',
  },
  staff: {
    label: 'Staff', rank: 1,
    badge: 'bg-slate-200 text-slate-600 border-slate-400 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
  },
  technician: {
    label: 'Technician', rank: 2,
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-400 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-600',
  },
  sales: {
    label: 'Sales Rep', rank: 3,
    badge: 'bg-orange-100 text-orange-800 border-orange-400 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-600',
  },
};

// Access description per selectable role, shown under the picker.
const ROLE_OPTIONS = [
  { value: 'technician', label: 'Technician — Repair Tracker & Workspace only' },
  { value: 'staff', label: 'Shop Staff — Repair Tracker, Workspace & Sales routes' },
  { value: 'admin', label: 'Full Admin — everything incl. Website CMS & accounts' },
  { value: 'sales', label: 'Sales Rep — Route Management only, own visits' },
];

function UserFormModal({ user, currentUser, onSaved, onClose }) {
  const showToast = useToast();
  const editing = Boolean(user);
  const isSelf = editing && user.kind === 'shop' && user.id === currentUser?.id;
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user ? user.role : 'staff');
  const [saving, setSaving] = useState(false);
  useEscapeClose(onClose);
  useBodyScrollLock(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const person = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
    };
    try {
      if (editing) {
        // Person fields go through the account's CURRENT kind first — after
        // a cross-kind role switch the old endpoint would 404 it — then the
        // role change runs through the any-account endpoint.
        if (user.kind === 'sales') {
          await salesRepsAPI.update(user.id, person);
        } else {
          await staffAPI.update(user.id, person);
        }
        if (!isSelf && role !== user.role) {
          await staffAPI.changeRole(user.id, role);
        }
        showToast('success', 'Account updated.');
      } else if (role === 'sales') {
        await salesRepsAPI.create({ ...person, password });
        showToast('success', 'Sales rep created — they can log in at /sales/login.');
      } else {
        await staffAPI.create({ ...person, password, role });
        showToast('success', 'Account created — they can log in now.');
      }
      onSaved();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to save the account.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {editing ? 'Edit Account' : 'Add User'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>First Name *</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={50} className={INPUT_CLS} autoFocus />
            </div>
            <div>
              <label className={LABEL_CLS}>Last Name *</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required maxLength={50} className={INPUT_CLS} />
            </div>
          </div>
          <div>
            <label className={LABEL_CLS}>Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={INPUT_CLS} />
          </div>
          {!editing && (
            <div>
              <label className={LABEL_CLS}>Password *</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required minLength={8} placeholder="Minimum 8 characters" className={INPUT_CLS}
                autoComplete="new-password"
              />
            </div>
          )}
          <div>
            <label className={LABEL_CLS}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isSelf}
              className={`${INPUT_CLS} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {isSelf && (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                You can&apos;t change your own access level.
              </p>
            )}
            {editing && !isSelf && role !== user.role && (role === 'sales' || user.role === 'sales') && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                {role === 'sales'
                  ? 'They’ll log in at /sales/login and see only Route Management.'
                  : 'They’ll log in at /workspace/login instead of the sales login.'}
              </p>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={CANCEL_BTN_CLS}>Cancel</button>
            <button type="submit" disabled={saving} className={SUBMIT_BTN_CLS}>
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onDone, onClose }) {
  const showToast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  useEscapeClose(onClose);
  useBodyScrollLock(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      showToast('error', 'Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      if (user.kind === 'sales') {
        await salesRepsAPI.update(user.id, { password });
      } else {
        await staffAPI.update(user.id, { password });
      }
      showToast('success', `Password reset for ${user.name}.`);
      onDone();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to reset the password.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Reset Password</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{user.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
          <div>
            <label className={LABEL_CLS}>New Password *</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={8} placeholder="Minimum 8 characters" className={INPUT_CLS}
              autoComplete="new-password" autoFocus
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Confirm Password *</label>
            <input
              type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              required minLength={8} className={INPUT_CLS} autoComplete="new-password"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={CANCEL_BTN_CLS}>Cancel</button>
            <button type="submit" disabled={saving} className={SUBMIT_BTN_CLS}>
              {saving ? 'Saving...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UsersPanel({ currentUser }) {
  const showToast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formTarget, setFormTarget] = useState(undefined); // undefined=closed, null=create, user=edit
  const [resetTarget, setResetTarget] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const load = useCallback(async (withSpinner = false) => {
    if (withSpinner) setLoading(true);
    try {
      const [shop, reps] = await Promise.all([staffAPI.list(), salesRepsAPI.list()]);
      const merged = [
        ...shop.map((u) => ({ ...u, kind: 'shop' })),
        ...reps.map((r) => ({
          ...r,
          kind: 'sales',
          role: 'sales',
          name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email,
        })),
      ];
      merged.sort((a, b) =>
        (ROLES[a.role]?.rank ?? 9) - (ROLES[b.role]?.rank ?? 9)
        || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      setUsers(merged);
    } catch {
      showToast('error', 'Failed to load users.');
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(true); }, [load]);

  const handleToggleActive = async () => {
    const user = confirmTarget;
    setConfirmTarget(null);
    setTogglingId(user.id);
    const api = user.kind === 'sales' ? salesRepsAPI : staffAPI;
    try {
      if (user.is_active) {
        await api.deactivate(user.id);
        showToast('success', `${user.name} can no longer log in.`);
      } else {
        await api.activate(user.id);
        showToast('success', `${user.name} can log in again.`);
      }
      load(false);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to update the account.'));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div>
      <TabHeader
        title="Users & Accounts"
        subtitle="Every login in one place — admins, staff, technicians and sales reps"
        action={(
          <button onClick={() => setFormTarget(null)} className={BTN_PRIMARY}>
            <span className="material-symbols-outlined text-base">person_add</span>
            Add User
          </button>
        )}
      />

      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">All Accounts</span>
          <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{users.length}</span>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-3 text-slate-500 dark:text-slate-400">Loading users...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base text-left">
              <thead className="text-sm uppercase text-slate-500 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60">
                <tr>
                  <th className="py-3 px-4 font-bold">Name</th>
                  <th className="py-3 px-4 font-bold hidden md:table-cell">Email</th>
                  <th className="py-3 px-4 font-bold">Role</th>
                  <th className="py-3 px-4 font-bold hidden sm:table-cell">Status</th>
                  <th className="py-3 px-4 font-bold hidden lg:table-cell">Activity</th>
                  <th className="py-3 px-4 font-bold hidden xl:table-cell">Added</th>
                  <th className="py-3 px-2 sm:px-4 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                {users.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((user) => {
                  const isSelf = user.kind === 'shop' && user.id === currentUser?.id;
                  const roleCfg = ROLES[user.role] || ROLES.staff;
                  return (
                    <tr key={`${user.kind}-${user.id}`} className={`transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/30 ${user.is_active ? '' : 'opacity-60'}`}>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-2.5 min-w-0">
                          <StaffAvatar userId={user.id} name={user.name} size="md" />
                          <span className="min-w-0">
                            <span className="block font-bold text-slate-900 dark:text-white truncate">
                              {user.name}
                              {isSelf && <span className="ml-1.5 text-[10px] font-black uppercase text-primary dark:text-blue-400">You</span>}
                            </span>
                            <span className="block md:hidden text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 hidden md:table-cell text-slate-600 dark:text-slate-300 text-sm">{user.email}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border whitespace-nowrap ${roleCfg.badge}`}>
                          {roleCfg.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 hidden sm:table-cell">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold border ${
                          user.is_active
                            ? 'bg-green-100 text-green-800 border-green-400 dark:bg-green-900/40 dark:text-green-300 dark:border-green-600'
                            : 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                          {user.is_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 hidden lg:table-cell text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {user.kind === 'sales'
                          ? `${user.total_visits} visit${user.total_visits !== 1 ? 's' : ''} · ${user.total_routes} route${user.total_routes !== 1 ? 's' : ''}`
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 hidden xl:table-cell text-slate-500 dark:text-slate-400 text-sm whitespace-nowrap">
                        {formatDateShortPacific(user.created_at)}
                      </td>
                      <td className="py-3.5 px-2 sm:px-4 text-right">
                        <div className="inline-flex items-center gap-1 sm:gap-1.5">
                          <button
                            onClick={() => setFormTarget(user)}
                            title="Edit name, email or role"
                            className="inline-flex items-center px-2 py-1.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold transition-all"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={() => setResetTarget(user)}
                            title="Reset this person's password"
                            className="inline-flex items-center px-2 py-1.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold transition-all"
                          >
                            <span className="material-symbols-outlined text-base">lock_reset</span>
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => setConfirmTarget(user)}
                              disabled={togglingId === user.id}
                              title={user.is_active ? 'Deactivate — blocks login, keeps history' : 'Re-activate this account'}
                              className={`inline-flex items-center px-2 py-1.5 rounded-lg text-sm font-bold border transition-all disabled:opacity-50 ${
                                user.is_active
                                  ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400'
                                  : 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 border-green-200 dark:border-green-800/40 text-green-600 dark:text-green-400'
                              }`}
                            >
                              <span className={`material-symbols-outlined text-base ${togglingId === user.id ? 'animate-spin' : ''}`}>
                                {togglingId === user.id ? 'progress_activity' : user.is_active ? 'person_off' : 'how_to_reg'}
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <PaginationBar
              currentPage={currentPage}
              totalItems={users.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          </div>
        )}
      </div>

      {formTarget !== undefined && (
        <UserFormModal
          user={formTarget}
          currentUser={currentUser}
          onSaved={() => { setFormTarget(undefined); load(false); }}
          onClose={() => setFormTarget(undefined)}
        />
      )}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onDone={() => setResetTarget(null)}
          onClose={() => setResetTarget(null)}
        />
      )}
      {confirmTarget && (
        <ConfirmModal
          message={confirmTarget.is_active
            ? `Deactivate ${confirmTarget.name}? They won't be able to log in until re-activated. Their history is kept.`
            : `Re-activate ${confirmTarget.name}? They'll be able to log in again.`}
          confirmLabel={confirmTarget.is_active ? 'Deactivate' : 'Activate'}
          confirmClass={confirmTarget.is_active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
          onConfirm={handleToggleActive}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  );
}

/**
 * Users & Accounts — the only account-management surface, behind the
 * admin-only settings page. The `dark` wrapper pins the dual-themed table to
 * its dark variants: Admin Settings is a dark-only surface, so without it a
 * light site theme would drop a light table into the dark shell.
 */
export default function UsersTab() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    authAPI.getMe().then(setCurrentUser).catch(() => {});
  }, []);

  return (
    <ToastProvider>
      <div className="dark">
        <UsersPanel currentUser={currentUser} />
      </div>
    </ToastProvider>
  );
}
