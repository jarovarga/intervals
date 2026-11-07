import * as i18n from './modules/i18n.js';
import * as install from './modules/install.js';
import * as preferences from './modules/preferences.js';
import * as router from './modules/router.js';
import * as settings from './modules/settings.js';
import * as sw from './modules/service-worker.js';
import * as update from './modules/update.js';

/** Shortest time between two checks for a new version while the app stays open: one hour. */
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

preferences.init();
i18n.useLanguage(i18n.resolve(preferences.get().language));
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
