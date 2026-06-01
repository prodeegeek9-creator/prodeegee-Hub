const CACHE = 'prodeegee-hub-v1';

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || 'Prodeegee Hub', {
      body: data.body || '',
      icon: data.icon || '/icon-192.png',
      badge: '/icon-72.png',
      tag: data.tag || 'hub-notif',
      data: { url: data.url || 'https://hub.prodeegee.com' },
      actions: data.actions || [],
      vibrate: [100, 50, 100],
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || 'https://hub.prodeegee.com';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('hub.prodeegee.com'));
      if (existing) { existing.focus(); return; }
      return clients.openWindow(url);
    })
  );
});
