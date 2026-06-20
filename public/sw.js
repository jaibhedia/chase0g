/*
 * Chase PWA service worker.
 *
 * Deliberately conservative: NETWORK-FIRST for same-origin GET requests, falling
 * back to a runtime cache only when the network is unavailable (offline). This makes
 * the app installable + offline-launchable without ever serving stale game code:
 * every online request still hits the network first.
 *
 * Anything that isn't a same-origin GET (websockets, the socket.io server, POSTs,
 * cross-origin assets) is left completely untouched and goes straight to the network.
 */
const CACHE = 'chase-runtime-v1';

self.addEventListener('install', () => {
  // Activate this worker immediately on first install.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop any caches from older worker versions.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only ever touch same-origin GET requests; everything else passes through.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Range requests (streamed audio) shouldn't be cache-managed here.
  if (req.headers.has('range')) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        // Cache a copy of successful basic responses for offline fallback.
        if (fresh && fresh.ok && fresh.type === 'basic') {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        // Offline: serve the cached copy if we have one.
        const cached = await caches.match(req);
        if (cached) return cached;
        // For navigations with no cache, fall back to the cached app shell.
        if (req.mode === 'navigate') {
          const shell = await caches.match('/');
          if (shell) return shell;
        }
        throw err;
      }
    })()
  );
});
