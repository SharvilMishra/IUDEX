// ==========================================================================
// e-CON - Service Worker
//
// Caches the app shell so previously visited screens still open offline.
// Bump CACHE_NAME whenever a shell file changes, or browsers will keep
// serving the old bundle.
//
// The activate handler deletes *every* cache whose name isn't the current
// one, which also clears the caches left behind by the previous SHIDEEP
// builds ("shideep-shell-*"). Those only ever held static shell files, so
// dropping them loses nothing: no user data has ever lived here. Anything
// that does persist locally lives in localStorage and is migrated by
// js/storage.js instead.
// ==========================================================================

const CACHE_NAME = "econ-shell-v3.0.0";

const SHELL_FILES = [
  "/",
  "/index.html",
  "/manifest.json",
  "/css/global.css",
  "/css/components.css",
  "/css/animations.css",
  "/js/app.js",
  "/js/router.js",
  "/js/ui.js",
  "/js/utils.js",
  "/js/storage.js",
  "/js/authScreen.js",
  "/js/usernameScreen.js",
  "/js/presence.js",
  "/js/installPrompt.js",
  "/components/appbar.js",
  "/components/navdrawer.js",
  "/js/navConfig.js",
  "/components/avatar.js",
  "/components/modal.js",
  "/components/toast.js",
  "/components/loader.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll is all-or-nothing: one 404 would abort the whole install and
      // leave the app with no offline shell at all.
      Promise.all(
        SHELL_FILES.map((file) =>
          cache.add(file).catch((err) =>
            console.warn("[e-CON sw] could not cache", file, err)
          )
        )
      )
    )
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

// Network-first for anything live, cache-first for the static shell.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Firebase Auth/Firestore traffic and the SDK modules must always hit the
  // network - a cached auth response or a stale snapshot is worse than being
  // offline.
  const isLive =
    url.hostname.includes("firestore") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("firebaseio") ||
    url.hostname.includes("firebaseapp") ||
    url.hostname.includes("gstatic") ||
    url.hostname.includes("identitytoolkit");

  if (isLive) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
