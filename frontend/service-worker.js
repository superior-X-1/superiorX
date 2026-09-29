/**
 * Measure X — PWA Service Worker (v2.4.0)
 * Enables offline caching of core app shell, assets, and statutory UI.
 * Bypasses network cache for live legal API transactions (/api/*).
 */

const CACHE_NAME = 'measurex-shell-v2.4.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/css/components.css',
  '/css/dashboard.css',
  '/css/certificate.css',
  '/css/responsive.css',
  '/js/config.js',
  '/js/data/mock-data.js',
  '/js/state/state.js',
  '/js/services/api.js',
  '/js/services/offline-sync.js',
  '/js/ui/validation.js',
  '/js/ui/components.js',
  '/js/app.js',
  '/js/vendor/html5-qrcode.min.js',
  '/assets/logo/measure-x-logo.svg',
  '/assets/logo/favicon.svg',
  '/assets/logo/measure-x-symbol.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[MeasureX ServiceWorker] Some assets could not be cached immediately:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Bypass ServiceWorker cache for all API requests to ensure database source-of-truth
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  // 2. Stale-While-Revalidate for static assets (instantaneous 0ms load from cache + async background update)
  const isStaticAsset = url.pathname.match(/\.(js|css|svg|png|jpg|jpeg|woff2?|ico)$/i) || STATIC_ASSETS.includes(url.pathname);
  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. Network-first with cache fallback for navigation and HTML documents
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html') || caches.match('/');
          }
          return new Response('Offline: Network unavailable', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});
