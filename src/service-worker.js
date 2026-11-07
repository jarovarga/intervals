/** The build replaces the placeholders with a content hash of the site and the list of files to precache. */
const CACHE_NAME = 'pwa-kit-__BUILD_HASH__';
const CACHE_PREFIX = 'pwa-kit-';
const PRECACHE_PATHS = JSON.parse('__PRECACHE_PATHS__');

/** Message from the page that lets a waiting worker take over once the visitor accepted the update. */
const SKIP_WAITING_MESSAGE = 'skip-waiting';

/** Shown when a navigation finds neither the cached shell nor a network, instead of the browser's error page. */
const OFFLINE_MESSAGE = 'The app is offline and not cached yet. Reconnect and reload.';
const OFFLINE_RESPONSE_INIT = {
  status: 503,
  statusText: 'Service Unavailable',
  headers: { 'Content-Type': 'text/plain; charset=utf-8' }
};

const APPLICATION_URL = new URL('./', self.registration.scope);
const APP_SHELL_URL = new URL('index.html', APPLICATION_URL).href;
const PRECACHE_URLS = new Set(PRECACHE_PATHS.map((path) => new URL(path, APPLICATION_URL).href));

/**
 * Precaches the application shell, bypassing the HTTP cache so that no stale file enters the new cache. A new version
 * then waits until the visitor accepts the update.
 *
 * @param {ExtendableEvent} event Install event.
 * @returns {void}
 */
const handleInstall = (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([...PRECACHE_URLS].map((url) => new Request(url, { cache: 'reload' }))))
  );
};

/**
 * Removes the caches of earlier versions and takes control of open pages, so that the first install works offline
 * without a reload.
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
 * Takes over from the old version when the page asks for it.
 *
 * @param {ExtendableMessageEvent} event Message event.
 * @returns {void}
 */
const handleMessage = (event) => {
  if (event.data === SKIP_WAITING_MESSAGE) self.skipWaiting();
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
    event.respondWith(
      caches
        .match(APP_SHELL_URL, { cacheName: CACHE_NAME })
        .then((shell) => shell ?? fetch(request))
        .catch(() => new Response(OFFLINE_MESSAGE, OFFLINE_RESPONSE_INIT))
    );
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
self.addEventListener('message', handleMessage);
self.addEventListener('fetch', handleFetch);
