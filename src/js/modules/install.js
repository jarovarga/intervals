const STORAGE_KEY = 'intervals:install-dismissed';
const IOS_PATTERN = /iPhone|iPad|iPod/;
const MAC_PATTERN = /Macintosh/;

/**
 * Decide whether to explain how to add the app to the Home Screen. Safari on iOS has no install prompt of its own,
 * so the explanation is shown to iOS visitors who run the app in the browser and have not dismissed it.
 *
 * @param {{ userAgent: string, maxTouchPoints: number, standalone: boolean, dismissed: boolean }} environment Browser.
 * @returns {boolean} True when the explanation should show.
 */
export const isEligible = ({ userAgent, maxTouchPoints, standalone, dismissed }) => {
  // iPadOS reports itself as a Mac, with a touch screen.
  const ios = IOS_PATTERN.test(userAgent) || (MAC_PATTERN.test(userAgent) && maxTouchPoints > 1);

  return ios && !standalone && !dismissed;
};

/**
 * @returns {boolean} Whether the explanation was dismissed earlier. Unreadable storage counts as not dismissed.
 */
const wasDismissed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch (error) {
    console.warn('The install hint state could not be read.', error);
    return false;
  }
};

/**
 * Show the installation explanation where it applies, and remember when the visitor dismisses it.
 *
 * @param {string} [selector] Selector of the explanation.
 * @returns {void}
 */
export const init = (selector = '[data-notice="install"]') => {
  const element = document.querySelector(selector);

  element.hidden = !isEligible({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: navigator.standalone === true || matchMedia('(display-mode: standalone)').matches,
    dismissed: wasDismissed()
  });

  element.querySelector('[data-action="dismiss-install"]').addEventListener('click', () => {
    element.hidden = true;

    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (error) {
      console.warn('The install hint could not be dismissed for good.', error);
    }
  });
};
