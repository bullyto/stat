
/* Stats ADN66 — SW for GitHub Pages
   Strategy: cache-first for static assets, network-first for API
*/
const VERSION = "adn66-sw-v4";
const STATIC_CACHE = `${VERSION}:static`;
const RUNTIME_CACHE = `${VERSION}:runtime`;

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./actifs/icon-192.png",
  "./actifs/icon-256.png",
  "./actifs/icon-384.png",
  "./actifs/icon-512.png",
  "./actifs/og-1200x630.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(STATIC_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (!k.startsWith(VERSION)) return caches.delete(k);
    }));
    self.clients.claim();
  })());
});

function isApi(url) {
  try {
    const u = new URL(url);
    return u.hostname === "stats.aperos.net" && u.pathname.startsWith("/api/");
  } catch { return false; }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = req.url;

  // API: network-first (no-store)
  if (isApi(url)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, res.clone());
        return res;
      } catch (e) {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        return new Response(JSON.stringify({ ok:false, error:"offline" }), {
          status: 503,
          headers: { "content-type":"application/json; charset=utf-8" }
        });
      }
    })());
    return;
  }

  // Static assets: cache-first
  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const res = await fetch(req);
      // only cache GET same-origin
      if (req.method === "GET" && new URL(url).origin === self.location.origin) {
        cache.put(req, res.clone());
      }
      return res;
    } catch {
      // Offline fallback to index for navigations
      if (req.mode === "navigate") {
        const fallback = await cache.match("./index.html");
        if (fallback) return fallback;
      }
      throw new Error("offline");
    }
  })());
});
