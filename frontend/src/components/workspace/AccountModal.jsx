import { useEffect, useState } from 'react';
import { pushAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import useEscapeClose from '../../utils/useEscapeClose';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import { getPushState, enablePush, disablePush, isIos } from '../../utils/push';
import StaffAvatar from './StaffAvatar';

const STATUS_COPY = {
  on: { label: 'On for this device', tone: 'text-green-700 dark:text-green-400', icon: 'notifications_active' },
  off: { label: 'Off', tone: 'text-slate-500 dark:text-slate-400', icon: 'notifications_off' },
  blocked: { label: 'Blocked in browser settings', tone: 'text-red-600 dark:text-red-400', icon: 'notifications_off' },
  'needs-home-screen': { label: 'Add to Home Screen first', tone: 'text-amber-700 dark:text-amber-400', icon: 'add_to_home_screen' },
  unsupported: { label: 'Not available in this browser', tone: 'text-slate-500 dark:text-slate-400', icon: 'notifications_off' },
};

/**
 * The staff member's own settings: push notifications for this device and
 * the password change. One place behind the sidebar's Account pill — a
 * sixth pill would not fit a 360px phone row.
 */
export default function AccountModal({ currentUser, onChangePassword, onClose }) {
  const showToast = useToast();
  const [state, setState] = useState({ status: 'checking' });
  const [devices, setDevices] = useState(null);
  const [serverEnabled, setServerEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  useEscapeClose(onClose);
  useBodyScrollLock(true);

  const refresh = async () => {
    try {
      const next = await getPushState();
      setState(next);
    } catch {
      setState({ status: 'unsupported' });
    }
    try {
      const me = await pushAPI.me();
      setDevices(me.devices);
      setServerEnabled(me.enabled);
    } catch {
      // Counts are informational only.
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleEnable = async () => {
    setBusy(true);
    try {
      await enablePush();
      showToast('success', 'Notifications are on for this device.');
      await refresh();
    } catch (err) {
      showToast('error', err?.message || apiErrorMessage(err, 'Could not enable notifications.'));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await disablePush();
      showToast('success', 'Notifications are off for this device.');
      await refresh();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Could not turn notifications off.'));
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    try {
      const { sent } = await pushAPI.test();
      showToast(sent > 0 ? 'success' : 'error', sent > 0
        ? `Sent to ${sent} device${sent === 1 ? '' : 's'} — check your notifications.`
        : 'Nothing was sent — no subscribed device found.');
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Test notification failed.'));
    } finally {
      setBusy(false);
    }
  };

  const copy = STATUS_COPY[state.status] || { label: 'Checking…', tone: 'text-slate-500', icon: 'hourglass_top' };
  const btnBase = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] sm:min-h-0 rounded-xl text-sm font-bold transition-colors disabled:opacity-50';
  const btnNeutral = `${btnBase} border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800`;
  const btnPrimary = `${btnBase} bg-primary hover:bg-blue-500 text-white font-black uppercase`;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 min-w-0">
            {currentUser && <StaffAvatar userId={currentUser.id} name={currentUser.name} size="lg" />}
            <div className="min-w-0">
              <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">My account</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{currentUser?.email}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 -m-2 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex-shrink-0">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-5">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Notifications on this device</h3>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 px-4 py-3">
              <p className={`flex items-center gap-2 text-sm font-bold ${copy.tone}`}>
                <span className="material-symbols-outlined text-base" aria-hidden="true">{copy.icon}</span>
                {copy.label}
              </p>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Task assignments, new online repair requests and ready-for-pickup alerts, straight to this phone — no messaging app needed.
                {devices != null && ` You have ${devices} device${devices === 1 ? '' : 's'} enabled.`}
              </p>
              {!serverEnabled && (
                <p className="mt-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">Not configured on the server yet — ask the admin to add the VAPID keys.</p>
              )}
              {state.status === 'needs-home-screen' && (
                <ol className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-1 list-decimal pl-4">
                  <li>Tap Safari’s <span className="font-bold">Share</span> button.</li>
                  <li>Choose <span className="font-bold">Add to Home Screen</span>, then <span className="font-bold">Add</span>.</li>
                  <li>Open the Workspace from that icon and turn notifications on here.</li>
                </ol>
              )}
              {state.status === 'blocked' && (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  {isIos() ? 'iPhone: Settings → Notifications → CNS Workspace → Allow.' : 'Open the site settings (the lock/tune icon in the address bar) and allow Notifications, then try again.'}
                </p>
              )}
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                {state.status === 'off' && (
                  <button type="button" onClick={handleEnable} disabled={busy || !serverEnabled} className={btnPrimary}>
                    <span className="material-symbols-outlined text-base" aria-hidden="true">notifications_active</span>
                    Turn on
                  </button>
                )}
                {state.status === 'on' && (
                  <>
                    <button type="button" onClick={handleTest} disabled={busy} className={btnPrimary}>
                      <span className="material-symbols-outlined text-base" aria-hidden="true">send</span>
                      Send a test
                    </button>
                    <button type="button" onClick={handleDisable} disabled={busy} className={btnNeutral}>
                      Turn off
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Password</h3>
            <button type="button" onClick={onChangePassword} className={`${btnNeutral} w-full`}>
              <span className="material-symbols-outlined text-base" aria-hidden="true">key</span>
              Change my password
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
