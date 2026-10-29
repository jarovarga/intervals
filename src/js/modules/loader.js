/**
 * @returns {Promise<void>} Resolves after the next two animation frames, once the first screen has been laid out and
 * the browser has requested the fonts it uses.
 */
const afterLayout = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/**
 * Hide the loader once the first screen is drawn and its fonts are ready, or after the timeout when a font is slow.
 *
 * @param {string} selector Selector of the loader element.
 * @param {{ timeout?: number }} [options] Longest wait for the fonts, in milliseconds.
 * @returns {void}
 */
export const init = (selector, { timeout = 3000 } = {}) => {
  const element = /** @type {HTMLElement | null} */ (document.querySelector(selector));

  if (!element) return;

  let timer;
  const fonts = afterLayout().then(() => document.fonts?.ready);
  const limit = new Promise((resolve) => {
    timer = setTimeout(resolve, timeout);
  });

  // Whatever the outcome, the loader must go, or it would cover the app for good.
  Promise.race([fonts, limit])
    .catch((error) => console.warn('The fonts could not be awaited.', error))
    .then(() => {
      clearTimeout(timer);
      element.hidden = true;
    });
};
