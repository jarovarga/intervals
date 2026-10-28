import * as dialog from './modules/dialog.js';
import * as editor from './modules/editor.js';
import * as install from './modules/install.js';
import * as intro from './modules/intro.js';
import * as loader from './modules/loader.js';
import * as marquee from './modules/marquee.js';
import * as player from './modules/player.js';
import * as router from './modules/router.js';
import * as sw from './modules/service-worker.js';
import * as sound from './modules/sound.js';
import * as update from './modules/update.js';
import * as wake from './modules/wake-lock.js';

/** Title of the app, which ends every page title. */
const APP_TITLE = 'Interval timer for circuit workouts';

/** Shortest time between two checks for a new version while the app stays open: one hour. */
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

dialog.init('[data-dialog="confirm"]');
sound.init();
wake.init();
router.init('[data-screen]', {
  screens: {
    intro: intro.init('[data-screen="intro"]', { title: APP_TITLE }),
    stats: intro.stats('[data-screen="intro"]', { title: APP_TITLE }),
    edit: editor.init('[data-screen="editor"]', { title: APP_TITLE }),
    timer: player.init('[data-screen="timer"]', {
      title: APP_TITLE,
      tickInterval: 200,
      lookahead: 1000,
      stale: 500,
      restartAfter: 2000,
      pulseDuration: 320,
      segmentDuration: 220,
      segmentStagger: 90
    })
  }
});
install.init('[data-notice="install"]');
update.init('[data-notice="update"]');
marquee.init('[data-marquee]', { speed: 32, pause: 2.5 });
loader.init('[data-loader="app"]', { timeout: 3000 });

window.addEventListener(
  'load',
  () =>
    sw.register('./service-worker.js', {
      checkInterval: UPDATE_CHECK_INTERVAL,
      bypassHosts: ['localhost', '127.0.0.1', '[::1]']
    }),
  { once: true }
);
