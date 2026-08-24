import { useState } from 'react';
import { staffAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import useEscapeClose from '../../utils/useEscapeClose';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import { INPUT_CLS, LABEL_CLS, CANCEL_BTN_CLS, SUBMIT_BTN_CLS } from './formStyles';

/**
 * Own-password change for whoever is signed in. This is the one piece of the
 * old Staff section that had to survive its removal: staff can't reach
 * /admin/settings, so without this they'd have no way to change a password.
 * Opens from the key button in the Workspace sidebar.
 */
export default function ChangePasswordModal({ onClose }) {
  const showToast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  useEscapeClose(onClose);
  useBodyScrollLock(true);

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
      onClose();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to change your password.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">key</span>
            Change My Password
          </h2>
          <button onClick={onClose} className="p-2 -m-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
          <div>
            <label className={LABEL_CLS}>Current Password</label>
            <input
              type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
              required className={INPUT_CLS} autoComplete="current-password" autoFocus
            />
          </div>
          <div>
            <label className={LABEL_CLS}>New Password</label>
            <input
              type="password" value={next} onChange={(e) => setNext(e.target.value)}
              required minLength={8} placeholder="Min. 8 characters" className={INPUT_CLS}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Confirm New</label>
            <input
              type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              required minLength={8} className={INPUT_CLS} autoComplete="new-password"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={CANCEL_BTN_CLS}>Cancel</button>
            <button type="submit" disabled={saving} className={SUBMIT_BTN_CLS}>
              {saving ? 'Saving...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
