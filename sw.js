const CACHE_NAME = 'sim-gedung-unsri-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/logo-unsri.png'
];

const CDN_CACHE_HOSTS = [
  'cdn.tailwindcss.com',
  'unpkg.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Jangan pernah cache endpoint API backend GAS / redirect GAS / WhatsApp Fonnte
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('script.googleusercontent.com') ||
    url.hostname.includes('api.fonnte.com')
  ) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network-first untuk halaman HTML (hanya cache jika response OK 200)
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.ok && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Stale-while-revalidate untuk library CDN agar cepat & tetap berfungsi saat offline
  if (CDN_CACHE_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          const networkFetch = fetch(e.request).then(res => {
            if (res && (res.ok || res.type === 'opaque')) {
              cache.put(e.request, res.clone());
            }
            return res;
          }).catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // Cache-first untuk aset statis lokal
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
