/* ==========================================================
   CARTOMANTES ONLINE – SERVICE WORKER (CACHE + NOTIF)
   GitHub Pages / PWA
   ✅ Em comunhão com painel + Firebase (via postMessage LOCAL_NOTIFY)
   ✅ Ajustado para start_url com ?pwa=true
========================================================== */

const CACHE_VERSION = "v1.1.6"; // 🔴 aumente sempre que trocar arquivos
const CACHE_NAME = `cartomantes-cache-${CACHE_VERSION}`;

/* ✅ coloque aqui APENAS arquivos que EXISTEM no repo */
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
   INSTALL (tolerante a 404)
=========================== */
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // ✅ tenta cachear tudo, mas não deixa um 404 derrubar o SW
    await Promise.all(
      APP_SHELL.map(async (path) => {
        try {
          const res = await fetch(path, { cache: "no-store" });
          if (res && res.ok) await cache.put(path, res.clone());
        } catch {}
      })
    );

    await self.skipWaiting();
  })());
});

/* ===========================
   ACTIVATE
=========================== */
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
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
  })());
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
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const copy = res.clone();
        const cache = await caches.open(CACHE_NAME);
        // ✅ guarda a versão sem depender do query
        await cache.put(url.pathname === "/" ? "./" : url.pathname, copy);
        return res;
      } catch {
        // ✅ fallback ignorando query
        const cached =
          (await caches.match(url.pathname, { ignoreSearch: true })) ||
          (await caches.match("./leituras.html", { ignoreSearch: true })) ||
          (await caches.match("./", { ignoreSearch: true }));

        return cached || Response.error();
      }
    })());
    return;
  }

  // ✅ Assets internos (cache-first)
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);
      if (!res || res.status !== 200) return res;
      const copy = res.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(req, copy);
      return res;
    } catch {
      return cached || Response.error();
    }
  })());
});

/* ==========================================================
   ✅ NOTIFICAÇÃO LOCAL (SEM PUSH REAL)
========================================================== */
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "LOCAL_NOTIFY") return;

  const title = data.title || "Cartomantes Online";
  const tag = data.tag || `cartomantes-${Date.now()}`;

  const options = {
    body: data.body || "Você tem uma nova atualização.",
    icon: "./logo.png",
    badge: "./logo.png",
    tag,
    renotify: true,
    data: { url: data.url || "./leituras.html?pwa=true" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ==========================================================
   ✅ PUSH REAL FUTURO
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
    data: { url: payload.url || "./leituras.html?pwa=true" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ===========================
   CLICK NA NOTIFICAÇÃO
=========================== */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rel = (event.notification.data && event.notification.data.url) || "./leituras.html?pwa=true";
  const target = new URL(rel, self.location.origin).href;

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });

    for (const client of allClients) {
      try {
        const cUrl = new URL(client.url);
        const tUrl = new URL(target);

        if (cUrl.origin === tUrl.origin) {
          await client.focus();
          try { await client.navigate(target); } catch {}
          return;
        }
      } catch {}
    }

    if (clients.openWindow) return clients.openWindow(target);
  })());
});
