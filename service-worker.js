/* ==========================================================
   CARTOMANTES ONLINE – SERVICE WORKER (CACHE + PUSH)
   GitHub Pages / PWA
========================================================== */

const CACHE_VERSION = "v1.0.9"; // 🔔 aumente para forçar update
const CACHE_NAME = `cartomantes-cache-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./leituras.html",
  "./notificacoes.html",
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
=========================== */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

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

  // Cache-first para arquivos
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

// Recebe a notificação
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}

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
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Clique na notificação → abre a página
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url;
  if (!url) return;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});

/* ✅ Ajuda quando o navegador troca a inscrição sozinho */
self.addEventListener("pushsubscriptionchange", (event) => {
  // Aqui você pode avisar seu backend para atualizar a subscription.
  // Como o SW não tem a VAPID pública com segurança, deixamos só um log.
  // O client (leituras.html) já tenta garantir inscrição ao abrir.
  event.waitUntil(Promise.resolve());
});
