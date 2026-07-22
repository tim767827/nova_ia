const CACHE = "novaai-v1";

const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/auth.css",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// ---- Installation : on met en cache les fichiers essentiels ----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      // addAll échoue en bloc si UN SEUL fichier est introuvable (404).
      // On ajoute donc chaque fichier séparément pour ne pas tout bloquer
      // si un fichier venait à manquer.
      return Promise.all(
        FILES_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("SW: impossible de mettre en cache", url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// ---- Activation : on supprime les anciens caches (novaai-v0, etc.) ----
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ---- Fetch : cache d'abord, sinon réseau, avec repli si offline ----
self.addEventListener("fetch", (event) => {
  // On ne gère que les requêtes GET (les POST vers /chat, /upload, etc.
  // doivent toujours passer par le réseau, jamais être mises en cache)
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // On met aussi en cache les nouvelles pages visitées (mise à jour douce)
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Hors ligne et rien en cache : on retombe sur la page d'accueil
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
    })
  );
});
