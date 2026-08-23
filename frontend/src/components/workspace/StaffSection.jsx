import { useState, useEffect, useCallback } from 'react';
import { staffAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import TabHeader from '../sales/TabHeader';
import { BTN_PRIMARY } from '../sales/ui';
import { INPUT_CLS, LABEL_CLS, CANCEL_BTN_CLS, SUBMIT_BTN_CLS } from './formStyles';
import { formatDateShortPacific } from '../../utils/dateFormat';
import useEscapeClose from '../../utils/useEscapeClose';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import StaffAvatar from './StaffAvatar';
import ConfirmModal from '../sales/ConfirmModal';

function StaffFormModal({ member, currentUser, onSaved, onClose }) {
  const showToast = useToast();
  const editing = Boolean(member);
  const isSelf = editing && member.id === currentUser?.id;
  const [firstName, setFirstName] = useState(member?.first_name || '');
  const [lastName, setLastName] = useState(member?.last_name || '');
  const [email, setEmail] = useState(member?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(member?.role || 'staff');
  const [saving, setSaving] = useState(false);
  useEscapeClose(onClose);
  useBodyScrollLock(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await staffAPI.update(member.id, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          ...(isSelf ? {} : { role }),
        });
        showToast('success', 'Staff member updated.');
      } else {
        await staffAPI.create({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          password,
          role,
        });
        showToast('success', 'Staff account created — they can log in now.');
      }
      onSaved();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to save the staff account.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {editing ? 'Edit Staff Member' : 'Add Staff Member'}
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
            <label className={LABEL_CLS}>Access Level</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isSelf}
              className={`${INPUT_CLS} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <option value="staff">Shop Staff — Repair Tracker, Shop Hub &amp; Sales routes</option>
              <option value="admin">Full Admin — everything incl. Website CMS &amp; accounts</option>
            </select>
            {isSelf && (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                You can&apos;t change your own access level.
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

function ResetPasswordModal({ member, onDone, onClose }) {
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
      await staffAPI.update(member.id, { password });
      showToast('success', `Password reset for ${member.name}.`);
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
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{member.name}</p>
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

function ChangeMyPasswordCard() {
  const showToast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (next !== confirm) {
      showToast('error', 'New passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await staffAPI.changePassword(current, next);
      showToast('success', 'Your password has been changed.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to change your password.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-800/60 p-5">
      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-1.5">
        <span className="material-symbols-outlined text-base">key</span>
        Change My Password
      </h3>
      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div>
          <label className={LABEL_CLS}>Current Password</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required className={INPUT_CLS} autoComplete="current-password" />
        </div>
        <div>
          <label className={LABEL_CLS}>New Password</label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} placeholder="Min. 8 characters" className={INPUT_CLS} autoComplete="new-password" />
        </div>
        <div>
          <label className={LABEL_CLS}>Confirm New</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} className={INPUT_CLS} autoComplete="new-password" />
        </div>
        <div className="sm:col-span-3">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50">
            {saving ? 'Saving...' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Staff accounts: everyone in the shop gets their own login. Create,
 * deactivate (guarded server-side against self and the last active admin),
 * reset passwords — no more CLI or database edits.
 */
export default function StaffSection({ currentUser, onStaffChanged }) {
  const showToast = useToast();
  const isAdmin = currentUser?.role === 'admin';
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formTarget, setFormTarget] = useState(undefined); // undefined=closed, null=create, member=edit
  const [resetTarget, setResetTarget] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const load = useCallback(async (withSpinner = false) => {
    if (withSpinner) setLoading(true);
    try {
      setMembers(await staffAPI.list());
    } catch {
      showToast('error', 'Failed to load staff.');
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(true); }, [load]);

  const afterChange = () => {
    load(false);
    onStaffChanged();
  };

  const handleToggleActive = async () => {
    const member = confirmTarget;
    setConfirmTarget(null);
    setTogglingId(member.id);
    try {
      if (member.is_active) {
        await staffAPI.deactivate(member.id);
        showToast('success', `${member.name} can no longer log in.`);
      } else {
        await staffAPI.activate(member.id);
        showToast('success', `${member.name} can log in again.`);
      }
      afterChange();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to update the account.'));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div>
      <TabHeader
        title="Staff"
        subtitle={isAdmin
          ? 'Everyone gets their own login — tasks and posts show who did what'
          : 'Who’s who in the shop'}
        action={isAdmin ? (
          <button onClick={() => setFormTarget(null)} className={BTN_PRIMARY}>
            <span className="material-symbols-outlined text-base">person_add</span>
            Add Staff
          </button>
        ) : undefined}
      />

      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
        {loading ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-3 text-slate-500 dark:text-slate-400">Loading staff...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base text-left">
              <thead className="text-sm uppercase text-slate-500 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60">
                <tr>
                  <th className="py-3 px-4 font-bold">Name</th>
                  <th className="py-3 px-4 font-bold hidden md:table-cell">Email</th>
                  <th className="py-3 px-4 font-bold">Access</th>
                  <th className="py-3 px-4 font-bold hidden sm:table-cell">Status</th>
                  <th className="py-3 px-4 font-bold hidden lg:table-cell">Added</th>
                  {isAdmin && <th className="py-3 px-2 sm:px-4 text-right font-bold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                {members.map((member) => {
                  const isSelf = member.id === currentUser?.id;
                  return (
                    <tr key={member.id} className={`transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/30 ${member.is_active ? '' : 'opacity-60'}`}>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-2.5 min-w-0">
                          <StaffAvatar userId={member.id} name={member.name} size="md" />
                          <span className="min-w-0">
                            <span className="block font-bold text-slate-900 dark:text-white truncate">
                              {member.name}
                              {isSelf && <span className="ml-1.5 text-[10px] font-black uppercase text-primary dark:text-blue-400">You</span>}
                            </span>
                            <span className="block md:hidden text-xs text-slate-500 dark:text-slate-400 truncate">{member.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 hidden md:table-cell text-slate-600 dark:text-slate-300 text-sm">{member.email}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${
                          member.role === 'admin'
                            ? 'bg-purple-100 text-purple-800 border-purple-400 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-600'
                            : 'bg-slate-200 text-slate-600 border-slate-400 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                        }`}>
                          {member.role === 'admin' ? 'Admin' : 'Staff'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 hidden sm:table-cell">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold border ${
                          member.is_active
                            ? 'bg-green-100 text-green-800 border-green-400 dark:bg-green-900/40 dark:text-green-300 dark:border-green-600'
                            : 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${member.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                          {member.is_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 hidden lg:table-cell text-slate-500 dark:text-slate-400 text-sm whitespace-nowrap">
                        {formatDateShortPacific(member.created_at)}
                      </td>
                      {isAdmin && <td className="py-3.5 px-2 sm:px-4 text-right">
                        <div className="inline-flex items-center gap-1 sm:gap-1.5">
                          <button
                            onClick={() => setFormTarget(member)}
                            title="Edit name or email"
                            className="inline-flex items-center px-2 py-1.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold transition-all"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={() => setResetTarget(member)}
                            title="Reset this person's password"
                            className="inline-flex items-center px-2 py-1.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold transition-all"
                          >
                            <span className="material-symbols-outlined text-base">lock_reset</span>
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => setConfirmTarget(member)}
                              disabled={togglingId === member.id}
                              title={member.is_active ? 'Deactivate — blocks login, keeps history' : 'Re-activate this account'}
                              className={`inline-flex items-center px-2 py-1.5 rounded-lg text-sm font-bold border transition-all disabled:opacity-50 ${
                                member.is_active
                                  ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400'
                                  : 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 border-green-200 dark:border-green-800/40 text-green-600 dark:text-green-400'
                              }`}
                            >
                              <span className={`material-symbols-outlined text-base ${togglingId === member.id ? 'animate-spin' : ''}`}>
                                {togglingId === member.id ? 'progress_activity' : member.is_active ? 'person_off' : 'how_to_reg'}
                              </span>
                            </button>
                          )}
                        </div>
                      </td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ChangeMyPasswordCard />

      {formTarget !== undefined && (
        <StaffFormModal
          member={formTarget}
          currentUser={currentUser}
          onSaved={() => { setFormTarget(undefined); afterChange(); }}
          onClose={() => setFormTarget(undefined)}
        />
      )}
      {resetTarget && (
        <ResetPasswordModal
          member={resetTarget}
          onDone={() => setResetTarget(null)}
          onClose={() => setResetTarget(null)}
        />
      )}
      {confirmTarget && (
        <ConfirmModal
          message={confirmTarget.is_active
            ? `Deactivate ${confirmTarget.name}? They won't be able to log in until re-activated. Their tasks and posts are kept.`
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
