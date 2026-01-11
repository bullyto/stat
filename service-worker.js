/* SW SAFE for ADN66 Stats (avoid stale JS/HTML issues) */
const VERSION = "stats-v2";
const CACHE = `adn66-stats-${VERSION}`;
const CORE = [
  "./",
  "./index.html",
  "./app.js",
  "./style.css",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try { await cache.addAll(CORE); } catch (_) { /* tolerate */ }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k.startsWith("adn66-stats-") && k !== CACHE) ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

function isCoreRequest(req){
  const url = new URL(req.url);
  const p = url.pathname;
  return p.endsWith("/") || p.endsWith("/index.html") || p.endsWith("/app.js") || p.endsWith("/style.css") || p.endsWith("/manifest.json");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Always go network-first for core to prevent "it doesn't work" after updates
  if (isCoreRequest(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        return cached || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // For other assets: cache-first
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (e) {
      return new Response("Offline", { status: 503 });
    }
  })());
});
