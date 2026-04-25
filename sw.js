/* =====================================================
   BillManager — Service Worker v2
   Push notifications + offline cache
   ===================================================== */

const CACHE_NAME = 'billmanager-v2';
// Rutas relativas al scope del SW — funciona en cualquier subpath (GitHub Pages /billmanager/)
const ASSETS = ['./index.html', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});

// Notificaciones push entrantes
self.addEventListener('push', (e) => {
  let data = { title: 'BillManager', body: 'Tienes un pago próximo', serviceId: null };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch(_) {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/icon-192.png',
      badge:   '/icon-192.png',
      tag:     'bm-' + (data.serviceId || 'general'),
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
      data:    { serviceId: data.serviceId, scope: self.registration.scope },
      actions: [
        { action: 'pay',   title: '💳 Pagar ahora' },
        { action: 'later', title: '⏰ Recordar luego' }
      ]
    })
  );
});

// Clic en notificación
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const { action, data } = e.notification;
  const scope = data?.scope || self.registration.scope;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if (w.url.startsWith(scope)) {
          w.postMessage({ type: 'NOTIFICATION_CLICK', action, serviceId: data?.serviceId });
          return w.focus();
        }
      }
      return clients.openWindow(scope + (data?.serviceId ? `?open=${data.serviceId}` : ''));
    })
  );
});

// Background sync
self.addEventListener('sync', (e) => {
  if (e.tag === 'check-due-services') {
    e.waitUntil(notifyClients());
  }
});

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'daily-check') {
    e.waitUntil(notifyClients());
  }
});

async function notifyClients() {
  const all = await clients.matchAll({ includeUncontrolled: true });
  all.forEach(c => c.postMessage({ type: 'CHECK_DUE_SERVICES' }));
}
