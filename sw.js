// ── Naik versi tiap update biar cache lama kehapus ──
const CACHE_NAME = 'kaskelas-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// ── 1. INSTALL ──
self.addEventListener('install', event => {
  self.skipWaiting(); // Paksa SW baru langsung aktif
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Pakai add() per item biar kalau satu gagal, yang lain tetep ke-cache
      return Promise.all(
        ASSETS_TO_CACHE.map(url => {
          return cache.add(url).catch(err => {
            console.warn('[SW] Gagal cache aset:', url, err);
          });
        })
      );
    })
  );
});

// ── 2. ACTIVATE ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Ambil kendali tab yang udah kebuka
});

// ── 3. FETCH ──
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Abaikan request non-GET (POST, PUT, dll) — biar gak ganggu API Supabase
  if (req.method !== 'GET') return;

  // Abaikan request ke origin lain (Supabase, dll), kecuali Google Fonts
  if (url.origin !== location.origin &&
      !url.href.includes('fonts.googleapis.com') &&
      !url.href.includes('fonts.gstatic.com')) {
    return;
  }

  // ── STRATEGI A: NETWORK-FIRST UNTUK HTML & NAVIGASI ──
  // Selalu ambil dari server dulu, biar update index.html langsung kebaca.
  // Kalau offline, baru pakai cache.
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(req)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          return response;
        })
        .catch(() => {
          return caches.match(req).then(cached => {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // ── STRATEGI B: CACHE-FIRST UNTUK ASET STATIS (Font, Gambar, Manifest) ──
  event.respondWith(
    caches.match(req).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;
      return fetch(req).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return networkResponse;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});

// ── 4. MESSAGE HANDLER (Opsional, buat paksa update) ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});