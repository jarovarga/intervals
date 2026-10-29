/**
 * Check for a new version whenever the app comes back to the foreground. A Home Screen app is resumed rather than
 * launched, so the browser would not look for an update by itself.
 *
 * @param {ServiceWorkerRegistration} registration Registration to check.
 * @param {number} checkInterval Shortest time between two checks.
 * @returns {void}
 */
const checkOnReturn = (registration, checkInterval) => {
  let checkedAt = Date.now();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - checkedAt < checkInterval) return;

    checkedAt = Date.now();
    registration.update().catch((error) => console.warn('The update check failed.', error));
  });
};

/**
 * Unregister every service worker of this origin and delete its caches.
 *
 * @returns {Promise<void>}
 */
const removeAll = async () => {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    await Promise.all(registrations.map((registration) => registration.unregister()));
    await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
  } catch (error) {
    console.warn('The service worker could not be removed.', error);
  }
};

/** @type {ServiceWorkerRegistration | undefined} */
let current;

/**
 * Look for a new version now. A new version takes over by itself, and the update notice then offers the reload.
 *
 * @returns {Promise<boolean | null>} Whether a new version was found, or null when no service worker runs or the check failed.
 */
export const checkNow = async () => {
  if (!current) return null;

  try {
    await current.update();

    return Boolean(current.installing || current.waiting);
  } catch (error) {
    console.warn('The update check failed.', error);
    return null;
  }
};

/**
 * Registers the service worker that makes the app installable and available offline.
 *
 * @param {string} [path] Service worker URL relative to the document.
 * @param {object} [options] Settings.
 * @param {number} [options.checkInterval] Shortest time in milliseconds between two checks for a new version while the app stays open.
 * @param {string[]} [options.bypassHosts] Host names on which no service worker runs and an earlier one is removed with its caches, so that development always loads the current files.
 * @returns {Promise<ServiceWorkerRegistration | undefined>} The registration, or nothing when it is unsupported, bypassed or fails.
 */
export const register = async (path = './service-worker.js', { checkInterval, bypassHosts = [] } = {}) => {
  if (!('serviceWorker' in navigator)) return undefined;

  if (bypassHosts.includes(location.hostname)) {
    await removeAll();
    return undefined;
  }

  try {
    const registration = await navigator.serviceWorker.register(new URL(path, document.baseURI).href, {
      updateViaCache: 'none'
    });

    current = registration;
    checkOnReturn(registration, checkInterval);

    return registration;
  } catch (error) {
    console.error('Service worker registration failed.', error);
    return undefined;
  }
};
