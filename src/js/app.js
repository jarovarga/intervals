import * as install from './modules/install.js';
import * as settings from './modules/settings.js';
import * as sw from './modules/service-worker.js';
import * as update from './modules/update.js';

/** Shortest time between two checks for a new version while the app stays open: one hour. */
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

install.init('[data-notice="install"]');
settings.init('[data-section="settings"]');

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
