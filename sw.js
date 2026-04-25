/* =====================================================
   BillManager — Service Worker v3
   GitHub Pages: https://max7ce.github.io/billmanager/
   ===================================================== */

const CACHE_NAME = 'billmanager-v3';
const BASE = '/billmanager';

// Solo cachear lo que realmente existe
const ASSETS = [
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png',
  BASE + '/icon-192-maskable.png',
  BASE + '/icon-512-maskable.png',
];

// ── Install ──────────────────────────────────────────
self.addEventListener('install', (e) => {
  console.log('[BillManager SW] Installing v3');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // addAll falla si cualquier asset no existe — usar add individual
        return Promise.allSettled(ASSETS.map(url => cache.add(url)));
      })
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────
self.addEventListener('activate', (e) => {
  console.log('[BillManager SW] Activating v3');
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[BillManager SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: network-first para HTML, cache-first para assets ──
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Solo manejar requests del mismo origen
  if (url.origin !== location.origin) return;

  // HTML: network-first (siempre contenido fresco)
  if (e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Assets: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

// ── Push notifications ───────────────────────────────
self.addEventListener('push', (e) => {
  let data = { title: 'BillManager', body: 'Tienes un pago próximo', serviceId: null };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch(_) {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    BASE + '/icon-192.png',
      badge:   BASE + '/icon-192.png',
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

// ── Notification click ───────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const serviceId = e.notification.data?.serviceId;
  const scope     = e.notification.data?.scope || self.registration.scope;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if (w.url.startsWith(location.origin + BASE)) {
          w.postMessage({ type: 'NOTIFICATION_CLICK', action: e.action, serviceId });
          return w.focus();
        }
      }
      const target = scope + (serviceId ? '?open=' + serviceId : '');
      return clients.openWindow(target);
    })
  );
});

// ── Background sync ──────────────────────────────────
self.addEventListener('sync', (e) => {
  if (e.tag === 'check-due-services') {
    e.waitUntil(pingClients());
  }
});

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'daily-check') {
    e.waitUntil(pingClients());
  }
});

async function pingClients() {
  const all = await clients.matchAll({ includeUncontrolled: true });
  all.forEach(c => c.postMessage({ type: 'CHECK_DUE_SERVICES' }));
}
