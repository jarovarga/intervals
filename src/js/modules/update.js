/**
 * Offer a reload when a new version of the app has taken over. The page keeps running the old files until it is
 * reloaded, so without this the new version would only appear after the app was closed and opened again.
 *
 * @param {string} [selector] Selector of the notice.
 * @returns {void}
 */
export const init = (selector = '[data-update]') => {
  if (!('serviceWorker' in navigator)) return;

  const element = document.querySelector(selector);
  // The first install also takes control of the page, which is not an update.
  const hadController = navigator.serviceWorker.controller !== null;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) element.hidden = false;
  });
  element.querySelector('[data-action="reload"]').addEventListener('click', () => location.reload());
};
