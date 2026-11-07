/** Message that lets the waiting worker take over. The service worker listens for the same text. */
const SKIP_WAITING_MESSAGE = 'skip-waiting';

/**
 * Offer a reload when a new version of the app is waiting. The page keeps running the old files until the visitor
 * accepts, so a reload never interrupts running work. After the visitor accepts, the new worker takes over and the
 * page reloads.
 *
 * @param {string} [selector] Selector of the notice, which sits in a live region that exists before the update.
 * @param {object} [options] Settings.
 * @param {ServiceWorkerRegistration} [options.registration] Registration to watch; nothing happens without one.
 * @returns {void}
 */
export const init = (selector = '[data-notice="update"]', { registration } = {}) => {
  if (!registration) return;

  const element = /** @type {HTMLElement} */ (document.querySelector(selector));
  let accepted = false;

  // The first install is not an update, so the notice needs a controller that the new worker would replace.
  const offer = () => {
    if (navigator.serviceWorker.controller) element.hidden = false;
  };

  if (registration.waiting) offer();

  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;

    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed') offer();
    });
  });

  element.querySelector('[data-action="reload"]').addEventListener('click', () => {
    accepted = true;
    registration.waiting?.postMessage(SKIP_WAITING_MESSAGE);
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (accepted) location.reload();
  });
};
