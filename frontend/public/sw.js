/* Service worker for Workspace push notifications.
   Deliberately no fetch handler: nothing is cached, so the public site and
   the admin app load exactly as before — this worker only shows pushes and
   routes taps back into the Workspace. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'CNS Workspace';
  const options = {
    body: data.body || '',
    icon: '/favicon-192x192.png',
    badge: '/favicon-192x192.png',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || '/workspace' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/workspace', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Reuse an open Workspace/admin tab when there is one; otherwise open a fresh one.
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
