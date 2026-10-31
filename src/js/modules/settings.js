import * as dialog from './dialog.js';
import { saveJson } from './download.js';
import { showSection } from './intro.js';
import * as library from './library.js';
import * as install from './install.js';
import * as router from './router.js';
import * as sound from './sound.js';
import * as sw from './service-worker.js';
import { MAX_COUNTDOWN } from './timeline.js';
import * as wakeLock from './wake-lock.js';

/** Largest export file the import accepts, in bytes. */
const MAX_IMPORT_BYTES = 1024 * 1024;

/** Percent steps of the volume control, which keeps the stored volume between 0 and 1. */
const VOLUME_SCALE = 100;

/**
 * Hand the stored settings to the modules that act on them.
 *
 * @returns {void}
 */
const applySettings = () => {
  const { volume, keepAwake } = library.getSettings();

  sound.setVolume(volume);
  void wakeLock.setEnabled(keepAwake);
};

/**
 * Offer the saved workouts as a JSON file.
 *
 * @returns {void}
 */
const downloadWorkouts = () => {
  saveJson(library.exportWorkouts(), `intervals-${new Date().toISOString().slice(0, 10)}.json`);
};

/**
 * The settings section of the intro screen: sound, the countdown, the screen lock, the data and the app itself. It
 * gives the router the screen to show: its element, its page title and what to do when it opens.
 *
 * @param {string} [selector] Selector of the intro screen.
 * @param {object} [options] Settings.
 * @param {string} [options.title] Title of the app, which ends every page title.
 */
export const init = (selector = '[data-screen="intro"]', { title } = {}) => {
  const element = /** @type {HTMLElement} */ (document.querySelector(selector));
  const section = /** @type {HTMLElement} */ (element.querySelector('[data-section="settings"]'));
  const control = (name) => /** @type {HTMLInputElement} */ (section.querySelector(`[data-setting="${name}"]`));
  const action = (name) => /** @type {HTMLButtonElement} */ (section.querySelector(`[data-action="${name}"]`));
  const importFile = /** @type {HTMLInputElement} */ (section.querySelector('[data-field="import"]'));
  const status = section.querySelector('[data-status="settings"]');

  const say = (message) => {
    status.textContent = message;
  };

  const render = () => {
    const settings = library.getSettings();
    const { countdown } = settings;

    control('sound').checked = settings.sound;
    control('volume').value = String(Math.round(settings.volume * VOLUME_SCALE));
    control('volume').disabled = !settings.sound;
    control('countdown').value = String(countdown);
    action('fewer-countdown').disabled = countdown <= 0;
    action('more-countdown').disabled = countdown >= MAX_COUNTDOWN;
    control('keep-awake').checked = settings.keepAwake;
    action('install').hidden = !install.isAvailable();
    say('');
  };

  const save = (changes) => {
    library.updateSettings(changes);
    applySettings();
    render();
  };

  const setCountdown = (value) => {
    if (!Number.isNaN(value)) save({ countdown: Math.min(MAX_COUNTDOWN, Math.max(0, value)) });
  };

  const readImport = async () => {
    const [file] = importFile.files;

    importFile.value = '';

    if (!file) return;

    if (file.size > MAX_IMPORT_BYTES) {
      say('That file is too large to be an export.');
      return;
    }

    const added = library.importWorkouts(await file.text());

    say(
      added === null
        ? 'That file is not an export from Intervals.'
        : `Imported ${added} workout${added === 1 ? '' : 's'}.`
    );
  };

  const deleteWorkouts = async () => {
    const confirmed = await dialog.ask({
      title: 'Delete all workouts?',
      text: 'Your saved workouts are removed from this device. Export them first to keep a copy.',
      confirmLabel: 'Delete all'
    });

    if (!confirmed || element.hidden) return;

    library.clearWorkouts();
    say('All workouts were deleted.');
  };

  const checkForUpdate = async () => {
    say('Checking for updates…');

    const found = await sw.checkNow();

    if (found === null) {
      say('Updates cannot be checked here.');
    } else {
      say(found ? 'A new version is being installed.' : 'You have the latest version.');
    }
  };

  const actions = {
    'fewer-countdown': () => setCountdown(library.getSettings().countdown - 1),
    'more-countdown': () => setCountdown(library.getSettings().countdown + 1),
    'export': downloadWorkouts,
    'import': () => importFile.click(),
    'delete-workouts': () =>
      deleteWorkouts().catch((error) => console.warn('The workouts could not be deleted.', error)),
    'check-update': () => checkForUpdate().catch((error) => console.warn('The update check failed.', error)),
    'install': () => {
      install.restore();
      router.navigate('#/');
    }
  };

  section.addEventListener('click', (event) => {
    const button = /** @type {Element} */ (event.target).closest('[data-action]');

    actions[button?.dataset.action]?.();
  });

  section.addEventListener('change', (event) => {
    const target = /** @type {HTMLInputElement} */ (event.target);

    if (target === importFile) {
      readImport().catch((error) => console.warn('The workouts could not be imported.', error));
    } else if (target === control('sound')) {
      save({ sound: target.checked });
    } else if (target === control('keep-awake')) {
      save({ keepAwake: target.checked });
    } else if (target === control('countdown')) {
      setCountdown(Number.parseInt(target.value, 10));
    }
  });

  control('volume').addEventListener('input', (event) => {
    save({ volume: Number(/** @type {HTMLInputElement} */ (event.target).value) / VOLUME_SCALE });
  });

  applySettings();

  return {
    element,
    title: () => `Settings – ${title}`,
    show: () => {
      render();
      showSection(element, 'settings');
    }
  };
};
