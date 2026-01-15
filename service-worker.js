/* ==========================================================
   CARTOMANTES ONLINE – SERVICE WORKER (CACHE + LOCAL_NOTIFY + PUSH REAL)
   GitHub Pages (subpasta) + Render Push Server
   ✅ Clique da notificação abre: /cartomantesonline.site/leituras.html?pwa=true
   ✅ LOCAL_NOTIFY compatível (Chrome/Samsung)
   ✅ PUSH REAL chega com app fechado (vindo do Render)
========================================================== */

const CACHE_VERSION = "v1.2.0"; // 🔴 AUMENTE sempre que trocar arquivos
const CACHE_NAME = `cartomantes-cache-${CACHE_VERSION}`;

// ✅ base do GH Pages (subpasta)
const BASE = "/cartomantesonline.site/";

// ✅ ajuste aqui se você criar novas páginas
const APP_SHELL = [
  BASE,
  BASE + "index.html",
  BASE + "leituras.html",
  BASE + "manifest.json",
  BASE + "logo.png",
  BASE + "service-worker.js",
  BASE + "notificacoes.html",
  BASE + "painel.html"
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

      await self.clients.claim();

      const allClients = await self.clients.matchAll({ includeUncontrolled: true });
      allClients.forEach((c) => {
        try { c.postMessage({ type: "SW_UPDATED", version: CACHE_VERSION }); } catch {}
      });
    })()
  );
});

/* ===========================
   FETCH
   ✅ NÃO CACHEIA EXTERNOS
   ✅ Network-first para HTML
   ✅ Cache-first para assets
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

          // fallback
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
   ✅ NOTIFICAÇÃO LOCAL (SEM PUSH REAL)
   Recebe postMessage do site:
     { type:"LOCAL_NOTIFY", title, body, url, tag }
========================================================== */
self.addEventListener("message", (event) => {
  try{
    const data = event.data || {};
    if (data.type !== "LOCAL_NOTIFY") return;

    const title = data.title || "Cartomantes Online";
    const body  = data.body  || "Você tem uma nova atualização.";

    // ✅ normaliza URL dentro do scope do GH Pages
    const rawUrl = data.url || (BASE + "leituras.html?pwa=true");
    const targetUrl = new URL(rawUrl, self.location.origin).href;

    const tag = data.tag || `co-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const options = {
      body,
      icon: BASE + "logo.png",
      badge: BASE + "logo.png",
      tag,
      renotify: true,
      requireInteraction: false,
      data: { url: targetUrl }
    };

    event.waitUntil(self.registration.showNotification(title, options));
  }catch(e){
    // silencioso
  }
});

/* ==========================================================
   ✅ PUSH REAL (VINDO DO RENDER)
   O servidor Render envia payload JSON:
   { title, body, url }
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

  // ✅ garante abrir sempre dentro do GH Pages
  const desiredPath = payload.url || (BASE + "leituras.html?pwa=true");
  const targetUrl = new URL(desiredPath, self.location.origin).href;

  const options = {
    body,
    icon: BASE + "logo.png",
    badge: BASE + "logo.png",
    data: { url: targetUrl }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ===========================
   CLICK NA NOTIFICAÇÃO
   ✅ Foca aba existente e navega
   ✅ Se não existir, abre nova
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
