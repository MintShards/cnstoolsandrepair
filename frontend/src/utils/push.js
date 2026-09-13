import { useEffect } from 'react';
import { pushAPI } from '../services/api';

// Web Push for the Workspace — notifications straight to a staff phone with
// no messaging app. Android Chrome works in the browser; iPhones need the
// Workspace added to the Home Screen first (iOS 16.4+), which is what the
// `needs-home-screen` state tells the user.

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('Service worker registration failed', err);
    return null;
  }
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** { status: 'unsupported' | 'needs-home-screen' | 'blocked' | 'on' | 'off', subscription? } */
export async function getPushState() {
  if (!pushSupported()) return { status: isIos() && !isStandalone() ? 'needs-home-screen' : 'unsupported' };
  if (isIos() && !isStandalone()) return { status: 'needs-home-screen' };
  if (Notification.permission === 'denied') return { status: 'blocked' };
  const reg = await navigator.serviceWorker.getRegistration();
  const subscription = reg ? await reg.pushManager.getSubscription() : null;
  return { status: subscription ? 'on' : 'off', subscription };
}

export async function enablePush() {
  const { enabled, public_key: publicKey } = await pushAPI.publicKey();
  if (!enabled || !publicKey) throw new Error('Push notifications are not configured on the server yet.');
  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker());
  if (!reg) throw new Error('Could not start the notification worker in this browser.');
  await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Notifications are blocked for this site in your browser settings.'
      : 'Notification permission was not granted.');
  }
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  const json = subscription.toJSON();
  await pushAPI.subscribe({
    endpoint: json.endpoint,
    keys: json.keys,
    expiration_time: json.expirationTime ?? null,
    user_agent: navigator.userAgent.slice(0, 300),
  });
  return subscription;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const subscription = reg ? await reg.pushManager.getSubscription() : null;
  if (!subscription) return;
  try {
    await pushAPI.unsubscribe(subscription.endpoint);
  } catch {
    // The browser-side unsubscribe below is what stops deliveries; a
    // server row left behind is pruned on its next failed send.
  }
  await subscription.unsubscribe();
}

/**
 * While the Workspace is mounted, present it as an installable app: point
 * the manifest link at the Workspace manifest (start_url /workspace,
 * standalone display — required for push on iOS) and add the home-screen
 * metas. Restored on unmount so the public site keeps its own manifest.
 */
export function useWorkspacePwa() {
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    const previousHref = link ? link.getAttribute('href') : null;
    if (link) link.setAttribute('href', '/workspace.webmanifest');
    const metas = [
      ['mobile-web-app-capable', 'yes'],
      ['apple-mobile-web-app-capable', 'yes'],
      ['apple-mobile-web-app-status-bar-style', 'default'],
      ['apple-mobile-web-app-title', 'CNS Workspace'],
      ['theme-color', '#1152d4'],
    ].map(([name, content]) => {
      const meta = document.createElement('meta');
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
      return meta;
    });
    registerServiceWorker();
    return () => {
      if (link && previousHref) link.setAttribute('href', previousHref);
      metas.forEach((meta) => meta.remove());
    };
  }, []);
}
