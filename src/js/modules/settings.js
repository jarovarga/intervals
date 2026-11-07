import * as i18n from './i18n.js';
import * as preferences from './preferences.js';
import * as sw from './service-worker.js';

/** The volume control counts in percent; the preference keeps a fraction from 0 to 1. */
const VOLUME_SCALE = 100;

/** Preferences that the steppers change, with their largest value; the smallest is 0. */
const COUNTS = { weeklyGoal: preferences.MAX_WEEKLY_GOAL, countdown: preferences.MAX_COUNTDOWN };

/** Preferences that the check boxes switch. */
const SWITCHES = ['sound', 'playback', 'keepAwake'];

/**
 * The settings screen: the weekly goal, the sound and the countdown, the screen lock and the language, each stored as
 * soon as it changes, and a check for a new version with a status message that reports the result.
 *
 * @param {string} [selector] Selector of the settings screen.
 * @param {{ onLanguage?: () => void }} [options] What else to do once the language of the page changed.
 * @returns {void}
 */
export const init = (selector = '[data-screen="settings"]', { onLanguage = () => {} } = {}) => {
  const section = /** @type {HTMLElement | null} */ (document.querySelector(selector));

  if (!section) return;

  const field = (name) => /** @type {HTMLInputElement} */ (section.querySelector(`[data-preference="${name}"]`));
  const steps = /** @type {HTMLButtonElement[]} */ ([...section.querySelectorAll('[data-step]')]);
  const volume = field('volume');
  const status = section.querySelector('[data-status="settings"]');

  const say = (message) => {
    status.textContent = message;
  };

  const showVolume = (percent) => {
    volume.value = String(percent);
    // Fills the track up to the thumb.
    volume.style.setProperty('--range-value', `${percent}%`);
  };

  const show = () => {
    const current = preferences.get();

    SWITCHES.forEach((name) => {
      field(name).checked = current[name];
    });
    Object.keys(COUNTS).forEach((name) => {
      field(name).value = String(current[name]);
    });
    steps.forEach((button) => {
      const name = button.dataset.step;
      const next = current[name] + Number(button.value);

      button.disabled = next < 0 || next > COUNTS[name];
    });
    showVolume(Math.round(current.volume * VOLUME_SCALE));
    field('language').value = i18n.getLanguage();
  };

  const save = (changes) => {
    preferences.update(changes);
    show();
  };

  const changeLanguage = (language) => {
    // The page switches first, because showing the stored values sets the field to the language in use.
    i18n.useLanguage(language);
    save({ language });
    onLanguage();
  };

  const changeCount = (name, text) => {
    const value = Number.parseInt(text, 10);

    // A value that is no number or out of range is ignored, and the field shows the stored one again.
    save(Number.isNaN(value) ? {} : { [name]: value });
  };

  section.addEventListener('change', (event) => {
    const target = /** @type {HTMLInputElement} */ (event.target);
    const name = target.dataset.preference;

    if (SWITCHES.includes(name)) save({ [name]: target.checked });
    if (name in COUNTS) changeCount(name, target.value);
    if (name === 'volume') save({ volume: Number(target.value) / VOLUME_SCALE });
    if (name === 'language') changeLanguage(target.value);
  });

  volume.addEventListener('input', () => showVolume(Number(volume.value)), { passive: true });

  steps.forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.step;

      save({ [name]: preferences.get()[name] + Number(button.value) });
    });
  });

  section.querySelector('[data-action="check-update"]').addEventListener('click', async () => {
    say(i18n.t('settings.checking'));

    const found = await sw.checkNow();

    if (found === null) {
      say(i18n.t('settings.cannotCheck'));
    } else {
      say(i18n.t(found ? 'settings.installing' : 'settings.latest'));
    }
  });

  show();
};
