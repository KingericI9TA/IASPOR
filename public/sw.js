const BUILD = "iaspor-dev";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
      const windows = await self.clients.matchAll({ type: "window" });
      for (const client of windows) {
        client.postMessage({ type: "IASPOR_SW", build: BUILD });
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/sw.js")) return;
  const path = url.pathname;
  const fresh =
    req.mode === "navigate" ||
    path.endsWith(".js") ||
    path.endsWith(".css") ||
    path.endsWith(".json") ||
    path.endsWith(".webmanifest") ||
    path.endsWith(".html");
  if (!fresh) return;
  event.respondWith(fetch(new Request(req, { cache: "reload" })).catch(() => fetch(req)));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const fallback = new URL("./?tab=pedido", self.registration.scope).href;
  const target = event.notification.data?.url || fallback;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(target);
          return;
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

void BUILD;
