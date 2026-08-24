const CACHE_VERSION = 'pikala-static-v2-11-3';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/assets/css/foundation.css', '/assets/vendor/lucide.min.js', '/logo.jpeg'];
const PRIVATE_PATHS = new Set([
  '/dashboard', '/dashboard.html', '/stations', '/stations.html', '/station', '/station.html',
  '/scanner', '/scanner.html', '/trajets', '/trajets.html', '/trajet', '/trajet.html',
  '/profil', '/profil.html', '/profile', '/support', '/support.html', '/ticket', '/ticket.html',
  '/incidents', '/incidents.html', '/notifications', '/notifications.html', '/abonnement',
  '/abonnement.html', '/admin', '/admin.html'
]);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('pikala-') && key !== CACHE_VERSION).map((key) => caches.delete(key)))));
  self.clients.claim();
});

function isSensitive(url) {
  return url.pathname.startsWith('/api/') || PRIVATE_PATHS.has(url.pathname);
}

function isLocalStatic(url) {
  return url.origin === self.location.origin && (/\.(?:css|js|mjs|png|jpe?g|webp|svg|ico)$/i.test(url.pathname) || url.pathname.startsWith('/icons/'));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isSensitive(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (isLocalStatic(url)) {
    event.respondWith(caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request);
      const refresh = fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') cache.put(request, response.clone());
        return response;
      });
      return cached || refresh;
    }));
  }
});
