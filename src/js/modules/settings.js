import * as i18n from './i18n.js';
import * as sw from './service-worker.js';

/**
 * The settings section: a button that looks for a new version and a status message that reports the result.
 *
 * @param {string} [selector] Selector of the settings section.
 * @returns {void}
 */
export const init = (selector = '[data-screen="settings"]') => {
  const section = /** @type {HTMLElement} */ (document.querySelector(selector));
  const action = (name) => /** @type {HTMLButtonElement} */ (section.querySelector(`[data-action="${name}"]`));
  const status = section.querySelector('[data-status="settings"]');

  const say = (message) => {
    status.textContent = message;
  };

  const checkForUpdate = async () => {
    say(i18n.t('settings.checking'));

    const found = await sw.checkNow();

    if (found === null) {
      say(i18n.t('settings.cannotCheck'));
    } else {
      say(i18n.t(found ? 'settings.installing' : 'settings.latest'));
    }
  };

  action('check-update').addEventListener('click', checkForUpdate);
};
