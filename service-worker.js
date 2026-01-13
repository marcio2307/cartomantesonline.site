/* ==========================================================
   CARTOMANTES ONLINE – SERVICE WORKER (CACHE + PUSH)
   GitHub Pages / PWA
========================================================== */

const CACHE_VERSION = "v1.1.0"; // ✅ aumente p/ forçar update
const CACHE_NAME = `cartomantes-cache-${CACHE_VERSION}`;

/**
 * ⚠️ IMPORTANTE:
 * Se algum arquivo listado aqui NÃO existir, o install pode falhar.
 * Por isso abaixo eu uso addAll com fallback (não quebra se faltar algo).
 */
const APP_SHELL = [
  "./",
  "./index.html",
  "./leituras.html",
  "./manifest.json",
  "./logo.png",
  "./service-worker.js",
];

/* ===========================
   INSTALL
=========================== */
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // ✅ Tenta cachear tudo, mas não falha se algum arquivo estiver faltando
      const results = await Promise.allSettled(
        APP_SHELL.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "reload" });
            if (!res || !res.ok) throw new Error(`HTTP ${res?.status}`);
            await cache.put(url, res);
          } catch (e) {
            // não derruba o install
            // console.log("SW cache skip:", url, String(e?.message || e));
          }
        })
      );

      // (results existe só pra debug se você quiser)
      return results;
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
   FETCH (CACHE)
=========================== */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Navegação (HTML) -> network-first com fallback
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const copy = res.clone();
          const cache = await caches.open(CACHE_NAME);
          await cache.put(req, copy);
          return res;
        } catch {
          const cached = await caches.match(req);
          return cached || (await caches.match("./leituras.html")) || Response.error();
        }
      })()
    );
    return;
  }

  // Cache-first para assets
  event.respondWith(
    (async () => {
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
    })()
  );
});

/* ==========================================================
   🔔 PUSH NOTIFICATIONS (mais compatível)
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
    // ✅ se logo.png não existir, isso não impede o push, só não mostra ícone
    icon: "./logo.png",
    badge: "./logo.png",
    vibrate: [120, 60, 120],

    // ✅ tag ajuda a não “sumir” / agrupar
    tag: "cartomantes-online",
    renotify: true,

    // ✅ mais compatível deixar false (alguns Android ignoram/bugam)
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const fallback =
    "https://marcio2307.github.io/cartomantesonline.site/leituras.html";
  const targetUrl = event.notification?.data?.url || fallback;

  event.waitUntil(
    (async () => {
      const clientList = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Se já existe uma aba do seu site aberta, foca nela
      for (const client of clientList) {
        // foca qualquer aba do mesmo site
        if (client.url && client.url.includes("marcio2307.github.io/cartomantesonline.site")) {
          return client.focus();
        }
      }

      // senão abre uma nova
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })()
  );
});

/**
 * ✅ Se o navegador trocar a subscription automaticamente,
 * você pode tratar aqui (opcional).
 * Obs: Para re-subscrever, normalmente você precisa do applicationServerKey
 * no front-end (leituras.html/notificacoes.html). Aqui deixamos só o log.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  // Alguns browsers disparam isso quando a inscrição expira/troca
  // Você normalmente recadastra via página (front-end) ao abrir o site.
  // console.log("pushsubscriptionchange", event);
});
