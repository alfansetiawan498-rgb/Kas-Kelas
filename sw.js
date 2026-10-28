/* ============================================================
   KasKelas Service Worker — v7
   Strategi:
   - Core assets (HTML/manifest): network-first, fallback cache
   - Fonts (Google Fonts + .woff2): cache-first
   - CDN libs (html2pdf): cache-first
   - Supabase API: bypass total (real-time)
   - Navigation preload: aktifkan untuk performa
   ============================================================ */

const CACHE_NAME = 'kaskelas-v7';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Harus SAMA PERSIS dengan URL di index.html
const EXT_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500;1,9..144,600&family=Inter:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

// ---------- INSTALL ----------
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // File utama wajib berhasil
      try {
        await cache.addAll(CORE_ASSETS);
      } catch (err) {
        console.error('[SW] Gagal cache core assets:', err.message);
      }

      // Aset eksternal: toleran gagal
      for (const url of EXT_ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[SW] Gagal cache aset eksternal:', url, err.message);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// ---------- ACTIVATE ----------
self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log('[SW] Hapus cache lama:', key);
              return caches.delete(key);
            }
          })
        )
      ),
      (async () => {
        if (self.registration.navigationPreload) {
          try { await self.registration.navigationPreload.enable(); }
          catch (err) { console.warn('[SW] Navigation preload gagal:', err); }
        }
      })()
    ]).then(() => self.clients.claim())
  );
});

// ---------- FETCH ----------
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Bypass Supabase (database real-time)
  if (url.includes('supabase.co')) return;

  // Hanya GET
  if (e.request.method !== 'GET') return;

  // A. Cache-first: font files & Google Fonts CSS
  if (
    e.request.destination === 'font' ||
    url.includes('fonts.gstatic.com') ||
    url.includes('fonts.googleapis.com')
  ) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request)
          .then((res) => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
            }
            return res;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // B. Cache-first: library CDN (html2pdf)
  if (url.includes('cdnjs.cloudflare.com')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request)
          .then((res) => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
            }
            return res;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // C. Network-first untuk navigasi (dengan navigation preload)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      (async () => {
        try {
          const preload = await e.preloadResponse;
          if (preload) {
            const clone = preload.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
            return preload;
          }
          const response = await fetch(e.request);
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        } catch (err) {
          const cached = await caches.match(e.request);
          if (cached) return cached;
          const fallback = await caches.match('./index.html');
          if (fallback) return fallback;
          throw err;
        }
      })()
    );
    return;
  }

  // D. Network-first untuk aset lain
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (
          response &&
          response.status === 200 &&
          (response.type === 'basic' || response.type === 'cors')
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

// ---------- MESSAGE (skipWaiting manual) ----------
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});