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
  '/frontend/css/main.css',
  '/frontend/css/components.css',
  '/frontend/css/dashboard.css',
  '/frontend/css/certificate.css',
  '/frontend/js/config.js',
  '/frontend/js/data/mock-data.js',
  '/frontend/js/state/state.js',
  '/frontend/js/services/api.js',
  '/frontend/js/ui/validation.js',
  '/frontend/js/ui/components.js',
  '/frontend/js/app.js',
  '/frontend/js/vendor/html5-qrcode.min.js',
  '/frontend/assets/logo/measure-x-logo.svg',
  '/frontend/assets/logo/favicon.svg',
  '/frontend/assets/logo/measure-x-symbol.svg'
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

  // 2. Network-first with cache fallback for HTML pages and app shell
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
