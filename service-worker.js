/* ==========================================================
   CARTOMANTES ONLINE – SERVICE WORKER
   CACHE + LOCAL_NOTIFY + PUSH REAL (Render)
   GitHub Pages (subpasta: /cartomantesonline.site/)
   ✅ Clique abre: /cartomantesonline.site/leituras.html?pwa=true
   ✅ Ícone pequeno Android (badge) usa icon-mono.png (remove quadrado branco)
========================================================== */

const CACHE_VERSION = "v1.2.4"; // 🔴 aumente sempre que editar
const CACHE_NAME = `cartomantes-cache-${CACHE_VERSION}`;

// ✅ base do GH Pages (subpasta)
const BASE = "/cartomantesonline.site/";

// ✅ SOMENTE arquivos que EXISTEM (conforme seu print)
const APP_SHELL = [
  BASE,
  BASE + "index.html",
  BASE + "leituras.html",
  BASE + "pacotes.html",
  BASE + "pix.html",
  BASE + "sorteio.html",
  BASE + "manifest.json",
  BASE + "logo.png",
  BASE + "icon-mono.png",
  BASE + "service-worker.js"
];

/* ===========================
   INSTALL
=========================== */
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // ✅ se algum arquivo falhar, não quebra tudo
      await Promise.all(
        APP_SHELL.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "no-cache" });
            if (res.ok) await cache.put(url, res.clone());
          } catch {}
        })
      );
    })()
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
    })()
  );
});

/* ===========================
   FETCH
   - Não cacheia externos
   - HTML: network-first
   - Assets: cache-first
=========================== */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // externos: não cacheia
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(req));
    return;
  }

  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  // HTML: network-first
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

          return (await caches.match(BASE + "leituras.html")) || (await caches.match(BASE));
        })
    );
    return;
  }

  // Assets: cache-first
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
   ✅ LOCAL_NOTIFY (sem push)
   Recebe postMessage do site:
   { type:"LOCAL_NOTIFY", title, body, url, tag }
========================================================== */
self.addEventListener("message", (event) => {
  try {
    const data = event.data || {};
    if (data.type !== "LOCAL_NOTIFY") return;

    const title = data.title || "Cartomantes Online";
    const body  = data.body  || "Você tem uma nova atualização.";

    const rawUrl = data.url || (BASE + "leituras.html?pwa=true");
    const targetUrl = new URL(rawUrl, self.location.origin).href;

    const tag = data.tag || `co-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: BASE + "logo.png",        // ícone grande (colorido)
        badge: BASE + "icon-mono.png",  // ✅ ícone pequeno Android (monocromático)
        tag,
        renotify: true,
        data: { url: targetUrl }
      })
    );
  } catch {}
});

/* ==========================================================
   ✅ PUSH REAL (Render)
   Render envia payload JSON:
   { title, body, url, icon }
========================================================== */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Cartomantes Online", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Cartomantes Online";
  const body  = payload.body  || "Você tem uma nova atualização.";

  // ✅ sempre abre dentro do seu GH Pages
  const desired = payload.url || (BASE + "leituras.html?pwa=true");
  const targetUrl = new URL(desired, self.location.origin).href;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: BASE + "logo.png",        // ícone grande (pode ser colorido)
      badge: BASE + "icon-mono.png",  // ✅ ícone pequeno Android (monocromático)
      data: { url: targetUrl }
    })
  );
});

/* ===========================
   CLICK NA NOTIFICAÇÃO
=========================== */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const fallback = new URL(BASE + "leituras.html?pwa=true", self.location.origin).href;

  const targetUrl =
    (event.notification && event.notification.data && event.notification.data.url)
      ? event.notification.data.url
      : fallback;

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const client of allClients) {
      try {
        await client.focus();
        try { await client.navigate(targetUrl); } catch {}
        return;
      } catch {}
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
