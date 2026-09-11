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
      } catch {
        // Offline: serve the cached copy if we have one.
        const cached = await caches.match(req);
        if (cached) return cached;
        // For navigations with no cache, fall back to the cached app shell.
        if (req.mode === 'navigate') {
          const shell = await caches.match('/');
          if (shell) return shell;
        }
        // Nothing cached and the network is gone. Rethrowing here used to turn a single
        // failed request into "FetchEvent resulted in a network error response" plus an
        // uncaught TypeError in the console — the page just broke, with no indication the
        // cause was the network. Returning a real Response lets the browser render
        // something and keeps the failure legible.
        return new Response(
          req.mode === 'navigate'
            ? '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
              '<body style="background:#11111c;color:#f4e7c3;font:16px system-ui;display:grid;' +
              'place-items:center;height:100vh;margin:0"><p>You appear to be offline. ' +
              'Reload when your connection is back.</p></body>'
            : '',
          {
            status: 503,
            statusText: 'Offline',
            headers: req.mode === 'navigate' ? { 'Content-Type': 'text/html' } : {},
          },
        );
      }
    })()
  );
});
