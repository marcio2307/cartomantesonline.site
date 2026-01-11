/* service-worker.js
   PWA simples e estável:
   - Instala e salva os arquivos básicos
   - Usa cache-first para estáticos
   - Usa network-first para navegação (HTML) para evitar "site preso no cache"
*/

const CACHE_VERSION = "v1.0.0";
const CACHE_NAME = `cartomantes-cache-${CACHE_VERSION}`;

// Coloque aqui os arquivos LOCAIS do seu projeto
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./logo.png",
  "./service-worker.js"
];

// Instala e faz precache do app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Ativa e limpa caches antigos
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

// Estratégias:
// - HTML (navigate): network-first (cai pro cache se offline)
// - Outros (CSS/JS/img): cache-first (cai pra rede se não existir)
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Só trabalha com GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Ignora coisas que não são http(s)
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // ✅ Para navegação (HTML)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // ✅ Para arquivos estáticos
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          // Só cacheia respostas boas
          if (!res || res.status !== 200) return res;

          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => cached);
    })
  );
});
