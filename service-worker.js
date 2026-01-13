/* ==========================================================
   CARTOMANTES ONLINE – SERVICE WORKER (CACHE + NOTIF)
   GitHub Pages / PWA
   ✅ Em comunhão com painel + Firebase (via postMessage LOCAL_NOTIFY)
   ✅ Clique da notificação SEMPRE abre: leituras.html
========================================================== */

const CACHE_VERSION = "v1.1.6"; // 🔴 AUMENTE sempre que trocar arquivos
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

      // ✅ Garante que versões antigas não fiquem presas
      await self.clients.claim();

      // ✅ opcional: avisa páginas abertas
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

          // ✅ fallback sempre para leituras (pwa=true)
          return (await caches.match("./leituras.html")) || (await caches.match("./"));
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
   - Disparada via postMessage do site/app (Firebase -> app -> SW)
========================================================== */
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "LOCAL_NOTIFY") return;

  const title = data.title || "Cartomantes Online";

  // ✅ tag única por mensagem (evita “sumir” quando manda várias)
  const tag = data.tag || `cartomantes-${Date.now()}`;

  const options = {
    body: data.body || "Você tem uma nova atualização.",
    icon: "./logo.png",
    badge: "./logo.png",
    tag,
    renotify: true,
    data: {
      // ✅ mesmo que o painel mande outra coisa, o CLICK vai forçar leituras.html
      url: data.url || "leituras.html?pwa=true"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ==========================================================
   ✅ (OPCIONAL) PUSH REAL FUTURO
========================================================== */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Cartomantes Online", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Cartomantes Online";
  const options = {
    body: payload.body || "Você tem uma nova atualização.",
    icon: "./logo.png",
    badge: "./logo.png",
    data: {
      url: payload.url || "leituras.html?pwa=true"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ===========================
   CLICK NA NOTIFICAÇÃO
   ✅ SEMPRE abre/foca leituras.html no caminho CERTO do GitHub Pages
=========================== */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // ✅ pega o scope real do SW (ex: https://marcio2307.github.io/cartomantesonline.site/)
  // e monta a URL correta SEMPRE:
  const targetUrl = new URL("leituras.html?pwa=true", self.registration.scope).href;

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      // ✅ tenta usar aba já aberta
      for (const client of allClients) {
        try {
          await client.focus();
          try { await client.navigate(targetUrl); } catch {}
          return;
        } catch {}
      }

      // ✅ senão abre nova aba/janela
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })()
  );
});
