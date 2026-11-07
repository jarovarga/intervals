import * as install from './install.js';
import * as sw from './service-worker.js';

/**
 * The settings section: a button that looks for a new version, a button that shows the install explanation again
 * where it applies, and a status message for both.
 *
 * @param {string} [selector] Selector of the settings section.
 * @returns {void}
 */
export const init = (selector = '[data-section="settings"]') => {
  const section = /** @type {HTMLElement} */ (document.querySelector(selector));
  const action = (name) => /** @type {HTMLButtonElement} */ (section.querySelector(`[data-action="${name}"]`));
  const status = section.querySelector('[data-status="settings"]');

  const say = (message) => {
    status.textContent = message;
  };

  const checkForUpdate = async () => {
    say('Checking for updates…');

    const found = await sw.checkNow();

    if (found === null) {
      say('The check for updates failed or is not available here.');
    } else {
      say(found ? 'A new version was found.' : 'The app is up to date.');
    }
  };

  action('install').hidden = !install.isAvailable();
  action('install').addEventListener('click', () => {
    install.restore();
    say('');
  });
  action('check-update').addEventListener('click', checkForUpdate);
};
