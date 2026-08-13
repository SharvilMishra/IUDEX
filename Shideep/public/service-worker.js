// ==========================================================================
// Shideep — Service Worker
// Caches the app shell so previously visited pages work offline (PRD §12).
// Bump CACHE_NAME whenever shell files change to force a refresh.
// ==========================================================================

const CACHE_NAME = "shideep-shell-v1.0.0";
const SHELL_FILES = [
  "/",
  "/index.html",
  "/css/global.css",
  "/css/components.css",
  "/css/animations.css",
  "/js/app.js",
  "/js/router.js",
  "/js/ui.js",
  "/js/utils.js",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for Firebase/API calls, cache-first for shell assets.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isFirebase = url.hostname.includes("firestore") ||
                      url.hostname.includes("googleapis") ||
                      url.hostname.includes("firebaseio") ||
                      url.hostname.includes("gstatic");

  if (isFirebase) return; // let these hit the network directly — never cache live data

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
