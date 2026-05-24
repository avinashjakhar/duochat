// DuoChat Service Worker v1.0
const CACHE = 'duochat-v1';

// Static assets to cache for offline shell
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css'
];

// ── Install: pre-cache the app shell ──────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Cache what we can — silently ignore failures (CDN fonts etc.)
      return Promise.allSettled(
        PRECACHE.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for API/WS, cache-first for assets ──
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip WebSocket upgrades and non-GET
  if (e.request.method !== 'GET') return;
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

  // Network-first strategy for navigation (HTML page)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for static assets (fonts, icons, CSS)
  if (
    url.hostname !== location.hostname ||
    e.request.destination === 'font' ||
    e.request.destination === 'style' ||
    url.pathname.startsWith('/icons/')
  ) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }
});

// ── Push notifications (future-ready) ────────────
self.addEventListener('push', (e) => {
  const data = e.data?.json() || { title: 'DuoChat', body: 'New message' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'DuoChat', {
      body: data.body || 'You have a new message',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      vibrate: [100, 50, 100],
      data: { url: '/' }
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'));
});