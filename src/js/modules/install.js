const STORAGE_KEY = 'intervals:install-dismissed';
const IOS_PATTERN = /iPhone|iPad|iPod/;
const MAC_PATTERN = /Macintosh/;

/**
 * @param {{ userAgent: string, maxTouchPoints: number }} environment Browser.
 * @returns {boolean} Whether the browser runs on iOS or iPadOS, which reports itself as a Mac with a touch screen.
 */
export const isIos = ({ userAgent, maxTouchPoints }) =>
  IOS_PATTERN.test(userAgent) || (MAC_PATTERN.test(userAgent) && maxTouchPoints > 1);

/**
 * Decide whether the app can be installed from here: Safari on iOS through Add to Home Screen, which it does not
 * offer by itself, and Chromium browsers once they have offered their installation prompt.
 *
 * @param {{ userAgent: string, maxTouchPoints: number, standalone: boolean, promptable: boolean }} environment Browser.
 * @returns {boolean} True when the installation guide applies.
 */
export const isAvailable = ({ userAgent, maxTouchPoints, standalone, promptable }) =>
  !standalone && (promptable || isIos({ userAgent, maxTouchPoints }));

/**
 * @param {{ userAgent: string, maxTouchPoints: number, standalone: boolean, promptable: boolean, dismissed: boolean }} environment Browser.
 * @returns {boolean} Whether the banner that leads to the installation guide shows.
 */
export const isEligible = ({ dismissed, ...environment }) => !dismissed && isAvailable(environment);

/** @returns {boolean} Whether the banner was dismissed earlier. Unreadable storage counts as not dismissed. */
const wasDismissed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch (error) {
    console.warn('The install banner state could not be read.', error);
    return false;
  }
};

/**
 * @param {boolean} dismissed Whether the banner stays hidden from now on.
 * @returns {void}
 */
const remember = (dismissed) => {
  try {
    if (dismissed) {
      localStorage.setItem(STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.warn('The install banner state could not be saved.', error);
  }
};

/**
 * @returns {boolean} Whether the app was opened from the Home Screen. Safari on iOS reports that through its own
 * `navigator.standalone`, which is not in the standard Navigator, so it is read by name.
 */
const isHomeScreenApp = () =>
  Reflect.get(navigator, 'standalone') === true || matchMedia('(display-mode: standalone)').matches;

/**
 * Offer the installation: a banner on the home screen that leads to the installation guide and can be dismissed for
 * good, the guide with an Install button where the browser has its own prompt and the steps for iOS where it has not,
 * and a button in the settings that brings the banner back and opens the guide.
 *
 * @param {{ banner: string, guide: string, trigger: string }} selectors The banner, the guide screen and the settings button.
 * @returns {void}
 */
export const init = ({ banner, guide, trigger }) => {
  const bannerElement = /** @type {HTMLElement | null} */ (document.querySelector(banner));
  const guideElement = /** @type {HTMLElement | null} */ (document.querySelector(guide));
  const triggerElement = /** @type {HTMLButtonElement | null} */ (document.querySelector(trigger));

  if (!bannerElement || !guideElement || !triggerElement) return;

  const promptButton = /** @type {HTMLButtonElement} */ (guideElement.querySelector('[data-action="prompt-install"]'));
  const iosSteps = /** @type {HTMLElement} */ (guideElement.querySelector('[data-install="ios"]'));
  /** @type {Event & { prompt: () => Promise<void> } | null} */
  let prompt = null;
  let installed = false;

  const environment = () => ({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: installed || isHomeScreenApp(),
    promptable: prompt !== null
  });

  const update = () => {
    bannerElement.hidden = !isEligible({ ...environment(), dismissed: wasDismissed() });
    triggerElement.hidden = !isAvailable(environment());
    promptButton.hidden = prompt === null;
    iosSteps.hidden = !isIos(environment());
  };

  // Chromium offers its own prompt only when asked from a click, so the event waits for the Install button.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    prompt = /** @type {Event & { prompt: () => Promise<void> }} */ (event);
    update();
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    prompt = null;
    update();
  });

  promptButton.addEventListener('click', async () => {
    try {
      await prompt?.prompt();
    } catch (error) {
      console.warn('The install prompt could not be shown.', error);
    }

    // A prompt can be shown only once; the browser offers a new one when it applies.
    prompt = null;
    update();
  });

  bannerElement.querySelector('[data-action="dismiss-install"]').addEventListener('click', () => {
    remember(true);
    update();
  });

  triggerElement.addEventListener('click', () => {
    remember(false);
    update();
    location.hash = guideElement.id;
  });

  update();
};
