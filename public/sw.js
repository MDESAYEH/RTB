const SHELL = "road-shell-v3";
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([
          "/offline.html",
          "/offline.js",
          "/icon.svg",
          "/logo.svg",
          "/patterns/white-topo.svg",
        ]))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("road-shell-") && key !== SHELL)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
// No live data or navigation response is ever cached.
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html")),
    );
});
