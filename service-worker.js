/* ==========================================================
   CARTOMANTES ONLINE – SERVICE WORKER (CACHE + PUSH)
   GitHub Pages / PWA
========================================================== */

const CACHE_VERSION = "v1.1.1"; // ✅ aumente p/ forçar update
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

  // ✅ não cacheia cross-origin (ex.: Render)
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
   🔔 PUSH NOTIFICATIONS (compatível)
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

  // ✅ abre sempre em URL do seu GitHub Pages (mesma origem do SW)
  const fallbackUrl = `${self.location.origin}/cartomantesonline.site/leituras.html`;
  const targetUrl = data.url || fallbackUrl;

  // ✅ ÍCONE/BADGE ABSOLUTO (resolve “não aparece nada” em alguns Android)
  const iconUrl = `${self.location.origin}/cartomantesonline.site/logo.png`;

  const options = {
    body,
    data: { url: targetUrl },
    icon: iconUrl,
    badge: iconUrl,
    vibrate: [120, 60, 120],
    tag: "cartomantes-online",
    renotify: true,
    // ✅ melhor compatibilidade:
    requireInteraction: false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification?.data?.url ||
    `${self.location.origin}/cartomantesonline.site/leituras.html`;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // ✅ foca qualquer aba do mesmo site, mesmo que URL tenha parâmetros
      for (const client of list) {
        if (client.url && client.url.startsWith(self.location.origin)) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
