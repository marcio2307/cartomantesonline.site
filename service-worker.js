/* ==========================================================
   CARTOMANTES ONLINE – SERVICE WORKER (CACHE + NOTIF)
   GitHub Pages / PWA
   ✅ Em comunhão com painel + Firebase (via postMessage LOCAL_NOTIFY)
   ✅ Corrigido: CLICK abre dentro do /cartomantesonline.site/
========================================================== */

const CACHE_VERSION = "v1.1.6"; // ✅ aumente sempre que trocar arquivos
const CACHE_NAME = `cartomantes-cache-${CACHE_VERSION}`;

/* ✅ ajuste aqui se você criar novas páginas */
const APP_SHELL = [
  "./",
  "./index.html",
  "./leituras.html",
  "./manifest.json",
  "./logo.png",
  "./service-worker.js",
  "./notificacoes.html",
  "./painel.html"
];

function toAbsolute(urlLike) {
  // ✅ garante abrir dentro do escopo do SW: .../cartomantesonline.site/
  try {
    return new URL(urlLike || "./leituras.html?pwa=true", self.registration.scope).href;
  } catch {
    return new URL("./leituras.html?pwa=true", self.registration.scope).href;
  }
}

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
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("cartomantes-cache-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );

      await self.clients.claim();

      const allClients = await self.clients.matchAll({ includeUncontrolled: true });
      allClients.forEach((c) => {
        try { c.postMessage({ type: "SW_UPDATED", version: CACHE_VERSION }); } catch {}
      });
    })()
  );
});

/* ===========================
   FETCH (CACHE)
   ✅ NÃO CACHEIA EXTERNOS
   ✅ Network-first para HTML
   ✅ Cache-first para assets
=========================== */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // ✅ não cacheia cross-origin
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(req));
    return;
  }

  // ✅ HTML (network-first, fallback cache)
  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;

          // ✅ fallback sempre dentro do repo
          return caches.match("./leituras.html") || caches.match("./");
        })
    );
    return;
  }

  // ✅ Assets internos (cache-first)
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
   ✅ NOTIFICAÇÃO LOCAL (SEM PUSH REAL)
========================================================== */
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "LOCAL_NOTIFY") return;

  const title = data.title || "Cartomantes Online";
  const tag = data.tag || `cartomantes-${Date.now()}`;

  const targetUrl = toAbsolute(data.url || "./leituras.html?pwa=true");

  const options = {
    body: data.body || "Você tem uma nova atualização.",
    icon: "./logo.png",
    badge: "./logo.png",
    tag,
    renotify: true,
    data: { url: targetUrl }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ===========================
   CLICK NA NOTIFICAÇÃO
   ✅ abre/foca e navega para url DENTRO DO REPO
=========================== */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = toAbsolute(
    (event.notification.data && event.notification.data.url) || "./leituras.html?pwa=true"
  );

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      // ✅ tenta usar aba já aberta do seu site (mesmo escopo)
      for (const client of allClients) {
        try {
          await client.focus();
          try { await client.navigate(targetUrl); } catch {}
          return;
        } catch {}
      }

      // ✅ senão abre nova aba/janela no alvo correto
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })()
  );
});
