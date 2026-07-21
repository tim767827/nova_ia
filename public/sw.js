const CACHE = "novaai-v1";

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE).then(cache =>
            cache.addAll([
                "/",
                "/index.html",
                "/style.css",
                "/app.js",
                "/auth.css"
            ])
        )
    );
});

self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
