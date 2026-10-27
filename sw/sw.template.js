// Service worker for Snap Lens. Generated into dist/sw.js at build time.
// It stores every file of the app on the iPad so the app keeps working offline,
// and refuses any request that is not for this app's own files.
const VERSION = __VERSION__;
const FILES = __FILES__;
const CACHE = 'snaplens-' + VERSION;

async function broadcast(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of clients) c.postMessage(msg);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    let done = 0;
    for (const f of FILES) {
      if (!(await cache.match(f, { ignoreVary: true }))) {
        const res = await fetch(new Request(f, { cache: 'reload' }));
        if (!res.ok) throw new Error('Failed to cache ' + f);
        await cache.put(f, res);
      }
      done++;
      broadcast({ type: 'sw-progress', done, total: FILES.length });
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('snaplens-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
    broadcast({ type: 'sw-ready', version: VERSION });
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'version') event.source?.postMessage({ type: 'sw-version', version: VERSION });
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || req.method !== 'GET') {
    // Nothing in this app should ever leave the device.
    event.respondWith(Response.error());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // ignoreVary: hosts send `Vary: Origin` etc., which would make module scripts miss the cache
    const hit = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = await cache.match('./', { ignoreVary: true });
      if (shell) return shell;
    }
    return fetch(req);
  })());
});
