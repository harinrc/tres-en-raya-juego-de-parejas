const CACHE_NAME = "amor-juegos-cache-v7";
const ASSETS = [
  "./",
  "./index.html",
  "./plataforma.css",
  "./plataforma.js",
  "./datos/juegos.js",
  "./manifest.webmanifest",
  "./juegos/tres-en-raya/index.html",
  "./juegos/tres-en-raya/styles.css",
  "./juegos/tres-en-raya/app.js",
  "./juegos/tres-en-raya/manifest.webmanifest",
  "./juegos/ahorcado/index.html",
  "./juegos/ahorcado/styles.css",
  "./juegos/ahorcado/app.js",
  "./juegos/ahorcado/palabras.js",
  "./juegos/ahorcado/manifest.webmanifest",
  "./icono-app/juega-juntos-192.png",
  "./icono-app/juega-juntos-512.png",
  "./icono-app/juega-juntos-180.png",
  "./icono-app/juega-juntos-og.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  // Navegaciones: red primero para servir siempre el catálogo actualizado.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => cachedResponse);
    })
  );
});