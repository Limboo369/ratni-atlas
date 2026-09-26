/* Overtake service worker (plan phase 18; built by build/make.py, served as /sw.js).
   The page itself and the map data (/data/): network first (a new build arrives at once), the cached copy when
   offline. Leaflet and the fonts from their CDNs (versioned URLs) and the icons: cached, refreshed in the background. /api/ and /ws are never touched.
   Web push: a notification from the server (deploy/api/push.js) — not shown while the game is open in front. */
const CACHE = 'overtake-__BUILD__';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('overtake-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const same = u.origin === self.location.origin;
  if (same && (u.pathname.startsWith('/api/') || u.pathname.startsWith('/ws'))) return;
  if (r.mode === 'navigate') {
    // every game link (/long-…, /game-…, /replay-…) is the same page
    e.respondWith(fetch(r).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put('/', res.clone()));
      return res;
    }).catch(() => caches.match('/')));
    return;
  }
  if (same && u.pathname.startsWith('/data/')) {
    // map data: network first like the page (a new build's page must never get the old build's map), cache offline
    e.respondWith(fetch(r).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put(r, res.clone()));
      return res;
    }).catch(() => caches.match(r).then((hit) => hit || Response.error())));
    return;
  }
  const cdn = /(^|\.)(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname);
  if ((same && u.pathname.startsWith('/icons/')) || cdn) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(r).then((hit) => {
      const net = fetch(r).then((res) => {
        if (res.ok || res.type === 'opaque') c.put(r, res.clone());
        return res;
      });
      return hit || net;
    })));
  }
});
self.addEventListener('push', (e) => {
  let m = {};
  try {
    m = e.data ? e.data.json() : {};
  } catch (_) {
    m = { body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    if (cs.some((c) => c.focused && c.visibilityState === 'visible')) return; // the game is open in front: it shows it itself
    return self.registration.showNotification(m.title || 'Overtake', { body: m.body || '', tag: m.tag || undefined, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: m.url || '/' } });
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => new URL(x.url).origin === self.location.origin);
    if (c) return c.navigate(url).then((w) => (w || c).focus()).catch(() => c.focus());
    return self.clients.openWindow(url);
  }));
});
