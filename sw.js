/* =====================================================
   BillManager — Service Worker
   Soporte offline para PWA Android
   ===================================================== */

const CACHE_NAME = 'billmanager-v1';
const ASSETS = ['/index.html'];

// Instalación: cachear assets principales
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activación: limpiar caches viejos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: servir desde cache, fallback a red
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// Notificaciones push (preparado para Fase 2)
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : { title: 'BillManager', body: 'Pago próximo' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: data
    })
  );
});
