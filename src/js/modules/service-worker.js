/** Shortest time between two checks for a new version while the app stays open. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Check for a new version whenever the app comes back to the foreground. A Home Screen app is resumed rather than
 * launched, so the browser would not look for an update by itself.
 *
 * @param {ServiceWorkerRegistration} registration Registration to check.
 * @returns {void}
 */
const checkOnReturn = (registration) => {
  let checkedAt = Date.now();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - checkedAt < CHECK_INTERVAL_MS) return;

    checkedAt = Date.now();
    registration.update().catch((error) => console.warn('The update check failed.', error));
  });
};

/**
 * Registers the service worker that makes the app installable and available offline.
 *
 * @param {string} [path] Service worker URL relative to the document.
 * @returns {Promise<ServiceWorkerRegistration | undefined>} The registration, or nothing when it is unsupported or fails.
 */
export const register = async (path = './service-worker.js') => {
  if (!('serviceWorker' in navigator)) return undefined;

  try {
    const registration = await navigator.serviceWorker.register(new URL(path, document.baseURI).href, {
      updateViaCache: 'none'
    });

    checkOnReturn(registration);

    return registration;
  } catch (error) {
    console.error('Service worker registration failed.', error);
    return undefined;
  }
};
