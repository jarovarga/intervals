import * as backup from './backup.js';
import * as dialog from './dialog.js';
import { saveJson } from './download.js';
import * as i18n from './i18n.js';
import * as library from './library.js';
import * as preferences from './preferences.js';

/**
 * The data actions of the settings: export everything to a file, import such a file and delete everything after a
 * confirmation. Each reports its result in the status message of the data group.
 *
 * @param {string} [selector] Selector of the settings screen.
 * @param {{ onChange?: () => void }} [options] What else to do after an import or a deletion changed the preferences or workouts.
 * @returns {void}
 */
export const init = (selector = '[data-screen="settings"]', { onChange = () => {} } = {}) => {
  const section = /** @type {HTMLElement | null} */ (document.querySelector(selector));
  const file = /** @type {HTMLInputElement | null} */ (section?.querySelector('[data-field="import"]'));
  const status = section?.querySelector('[data-status="data"]');

  if (!section || !file || !status) return;

  const action = (name) => /** @type {HTMLButtonElement} */ (section.querySelector(`[data-action="${name}"]`));

  const say = (message) => {
    status.textContent = message;
  };

  const importFile = async (chosen) => {
    if (chosen.size > backup.MAX_BYTES) {
      say(i18n.t('settings.tooLarge'));
      return;
    }

    const read = backup.readBackup(await chosen.text());

    if (!read) {
      say(i18n.t('settings.notExport'));
      return;
    }

    const result = backup.restore(read);

    onChange();
    say(
      result.saved
        ? i18n.t('settings.imported', {
            workouts: i18n.count('count.workouts', result.workouts),
            completions: i18n.count('count.finished', result.completions)
          })
        : i18n.t('settings.notSaved')
    );
  };

  const deleteAll = async () => {
    const confirmed = await dialog.ask({
      title: i18n.t('settings.deleteTitle'),
      text: i18n.t('settings.deleteText'),
      confirmLabel: i18n.t('settings.deleteConfirm')
    });

    if (!confirmed) return;

    const cleared = library.clearAll();
    const reset = preferences.reset();

    onChange();
    say(i18n.t(cleared && reset ? 'settings.deleted' : 'settings.notSaved'));
  };

  action('export').addEventListener('click', () => {
    const now = new Date();

    saveJson(backup.createBackup(now), backup.fileName(now));
  });

  action('import').addEventListener('click', () => file.click());

  file.addEventListener('change', async () => {
    const [chosen] = file.files;

    // Choosing the same file again must fire another change.
    file.value = '';

    if (chosen) await importFile(chosen);
  });

  action('delete-all').addEventListener('click', deleteAll);
};
