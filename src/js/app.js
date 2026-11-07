import * as data from './modules/data.js';
import * as dialog from './modules/dialog.js';
import * as i18n from './modules/i18n.js';
import * as install from './modules/install.js';
import * as library from './modules/library.js';
import * as preferences from './modules/preferences.js';
import * as presets from './modules/presets.js';
import * as router from './modules/router.js';
import * as settings from './modules/settings.js';
import * as sw from './modules/service-worker.js';
import * as update from './modules/update.js';

/** Shortest time between two checks for a new version while the app stays open: one hour. */
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

preferences.init();
library.init();
dialog.init('[data-dialog="confirm"]');
i18n.useLanguage(i18n.resolve(preferences.get().language));
// The ready-made workouts take the names of the language in use.
library.seed(presets.createStarterWorkouts());
router.init('[data-screen]', {
  home: 'workouts',
  navigation: '[data-navigation="tabs"]',
  appTitle: () => i18n.t('app.title')
});
install.init({
  banner: '[data-notice="install"]',
  guide: '[data-screen="install"]',
  trigger: '[data-action="show-install"]'
});
settings.init('[data-screen="settings"]', { onLanguage: router.refreshTitle });
data.init('[data-screen="settings"]', {
  // An import or a deletion may change the preferences, including the language.
  onChange: () => {
    i18n.useLanguage(i18n.resolve(preferences.get().language));
    // The ready-made workouts take the names of the language in use.
    library.seed(presets.createStarterWorkouts());
    router.refreshTitle();
    settings.refresh();
  }
});

window.addEventListener(
  'load',
  async () => {
    const registration = await sw.register('./service-worker.js', {
      checkInterval: UPDATE_CHECK_INTERVAL,
      bypassHosts: ['localhost', '127.0.0.1', '[::1]']
    });

    update.init('[data-notice="update"]', { registration });
  },
  { once: true }
);
