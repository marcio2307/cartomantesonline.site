/* ==========================================================
   CARTOMANTES ONLINE – SERVICE WORKER (CACHE + PUSH)
   GitHub Pages / PWA
========================================================== */

const CACHE_VERSION = "v1.1.0"; // ✅ aumente p/ forçar update
const CACHE_NAME = `cartomantes-cache-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./leituras.html",
  "./manifest.json",
  "./logo.png",
  "./service-worker.js"
];

/* ===========================
   INSTALL
=========================== */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

/* ===========================
   ACTIVATE
=========================== */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("cartomantes-cache-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ===========================
   FETCH (CACHE)
   ✅ NÃO CACHEIA REQUISIÇÕES EXTERNAS (Render etc)
=========================== */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // ✅ IMPORTANTE: não cacheia cross-origin (ex.: https://envio-6.onrender.com)
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(req));
    return;
  }

  // Navegação (HTML)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match("./leituras.html"))
        )
    );
    return;
  }

  // Cache-first para arquivos do seu site
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          if (!res || res.status !== 200) return res;
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => cached);
    })
  );
});

/* ==========================================================
   🔔 PUSH NOTIFICATIONS
========================================================== */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    try {
      data = { body: event.data ? event.data.text() : "" };
    } catch {
      data = {};
    }
  }

  const title = data.title || "Cartomantes Online";
  const body = data.body || "Você tem uma nova notificação.";
  const url =
    data.url ||
    "https://marcio2307.github.io/cartomantesonline.site/leituras.html";

  const options = {
    body,
    data: { url },
    icon: "./logo.png",
    badge: "./logo.png",
    vibrate: [120, 60, 120],
    tag: "cartomantes-online",
    renotify: true,
    requireInteraction: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url;
  const fallback = "https://marcio2307.github.io/cartomantesonline.site/leituras.html";
  const targetUrl = url || fallback;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && "focus" in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});
