const CACHE_NAME = 'kaskelas-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      return fetch(event.request).then(fetchRes => {
        return caches.open(CACHE_NAME).then(cache => {
          if (event.request.method === 'GET' && fetchRes.status === 200) {
            cache.put(event.request, fetchRes.clone());
          }
          return fetchRes;
        });
      });
    }).catch(() => {
      if (event.request.mode === 'navigate') return caches.match('./index.html');
    })
  );
});