/* ==========================================================
   CARTOMANTES ONLINE – SERVICE WORKER (CACHE + PUSH)
   GitHub Pages / PWA
   ✅ Ajustado p/ GitHub Pages (scope /repo/) + ícones absolutos
========================================================== */

const CACHE_VERSION = "v1.1.2"; // ✅ aumente p/ forçar update
const CACHE_NAME = `cartomantes-cache-${CACHE_VERSION}`;

/* ✅ Detecta base do GitHub Pages automaticamente:
   - em github.io: /NOME-REPO/
   - em domínio próprio: /
*/
function getBasePath() {
  const host = self.location.hostname;
  const parts = self.location.pathname.split("/").filter(Boolean);

  // github.io -> "/repo/"
  if (host.endsWith("github.io") && parts.length > 0) {
    return `/${parts[0]}/`;
  }
  return "/";
}

const BASE_PATH = getBasePath();

/* ✅ Monta URLs absolutas (evita falhas em Android e cache estranho) */
const APP_SHELL = [
  `${BASE_PATH}`,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}leituras.html`,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}logo.png`,
  `${BASE_PATH}service-worker.js`
];

/* ===========================
   INSTALL
=========================== */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // ✅ tenta cachear tudo; se algo falhar, não derruba o install
      for (const url of APP_SHELL) {
        try { await cache.add(url); } catch {}
      }
    })
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

  // ✅ não cacheia cross-origin (ex.: https://envio-7.onrender.com)
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(req));
    return;
  }

  // Navegação (HTML) -> network-first com fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match(`${BASE_PATH}leituras.html`))
        )
    );
    return;
  }

  // Cache-first para assets do site
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
   🔔 PUSH NOTIFICATIONS (compatível / Android)
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

  // ✅ sempre abre no seu site (mesma origem do SW)
  const fallbackUrl = `${self.location.origin}${BASE_PATH}leituras.html`;
  const targetUrl = (data.url && typeof data.url === "string") ? data.url : fallbackUrl;

  // ✅ ícone/badge ABSOLUTO (corrige “não aparece” em alguns Android)
  const iconUrl = `${self.location.origin}${BASE_PATH}logo.png`;

  const options = {
    body,
    data: { url: targetUrl },
    icon: iconUrl,
    badge: iconUrl,
    vibrate: [120, 60, 120],
    tag: "cartomantes-online",
    renotify: true,
    // ✅ melhor compatibilidade (evita travar notificação)
    requireInteraction: false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification?.data?.url ||
    `${self.location.origin}${BASE_PATH}leituras.html`;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // ✅ foca uma aba do mesmo site, e se não tiver, abre a URL
      for (const client of list) {
        if (client.url && client.url.startsWith(self.location.origin)) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
