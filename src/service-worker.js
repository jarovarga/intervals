// The build replaces the placeholders with a content hash of the site and the list of files to precache.
const CACHE_NAME = 'intervals-__BUILD_HASH__';
const CACHE_PREFIX = 'intervals-';
const PRECACHE_PATHS = JSON.parse('__PRECACHE_PATHS__');

const APPLICATION_URL = new URL('./', self.registration.scope);
const APP_SHELL_URL = new URL('index.html', APPLICATION_URL).href;
const PRECACHE_URLS = new Set(PRECACHE_PATHS.map((path) => new URL(path, APPLICATION_URL).href));

/**
 * Precaches the application shell, bypassing the HTTP cache so that no stale file enters the new cache.
 *
 * @param {ExtendableEvent} event Install event.
 * @returns {void}
 */
const handleInstall = (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([...PRECACHE_URLS].map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
};

/**
 * Removes the caches of earlier versions and takes control of open pages.
 *
 * @param {ExtendableEvent} event Activate event.
 * @returns {void}
 */
const handleActivate = (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
};

/**
 * Serves precached files cache-first and navigations from the cached shell, which keeps the app working offline.
 * The bundle URLs carry a version query, so the lookup ignores the query string.
 *
 * @param {FetchEvent} event Fetch event.
 * @returns {void}
 */
const handleFetch = (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(caches.match(APP_SHELL_URL, { cacheName: CACHE_NAME }).then((shell) => shell ?? fetch(request)));
    return;
  }

  if (PRECACHE_URLS.has(url.origin + url.pathname)) {
    event.respondWith(
      caches.match(request, { cacheName: CACHE_NAME, ignoreSearch: true }).then((cached) => cached ?? fetch(request))
    );
  }
};

self.addEventListener('install', handleInstall);
self.addEventListener('activate', handleActivate);
self.addEventListener('fetch', handleFetch);
