/*
 * Solid.drive service worker.
 *
 * Registered by src/shared/utils/registerServiceWorker under the app's
 * BASE_URL scope. Everything below resolves against the worker's own
 * location, so the very same file works whether the app is served at
 * '/' (tests / a bare deployment) or under the WSE reverse proxy at
 * '/solid-hello-world-frontend-react/'.
 *
 * Strategy: network-first. Online requests always hit the network, so
 * Vite's dev HMR and fresh production assets are never served stale;
 * successful same-origin GETs are mirrored into the cache so the
 * installed app still opens and renders its shell when offline.
 */

const CACHE = 'solid-drive-shell-v1';

const SCOPE_URL = new URL('./', self.location.href);
const SHELL_INDEX = SCOPE_URL.href;
const APP_SHELL = [
  './',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
].map((path) => new URL(path, SCOPE_URL).href);

self.addEventListener('install', (event) => {
  // Take over as soon as the new worker is installed instead of waiting
  // for every old tab to close.
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      // A single missing shell asset must not abort activation.
      .catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      // Control already-open clients without requiring a reload.
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Mirror successful same-origin responses for offline use.
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((hit) => {
          if (hit) return hit;
          // Offline navigations fall back to the cached app shell so a
          // deep route still boots the SPA.
          if (request.mode === 'navigate') return caches.match(SHELL_INDEX);
          return Response.error();
        }),
      ),
  );
});
