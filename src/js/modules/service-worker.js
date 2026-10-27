/**
 * Registers the service worker that makes the app installable and available offline.
 *
 * @param {string} [path] Service worker URL relative to the document.
 * @returns {Promise<ServiceWorkerRegistration | undefined>} The registration, or nothing when it is unsupported or fails.
 */
export const register = async (path = './service-worker.js') => {
  if (!('serviceWorker' in navigator)) return undefined;

  try {
    return await navigator.serviceWorker.register(new URL(path, document.baseURI).href, { updateViaCache: 'none' });
  } catch (error) {
    console.error('Service worker registration failed.', error);
    return undefined;
  }
};
