import * as dialog from './modules/dialog.js';
import * as editor from './modules/editor.js';
import * as home from './modules/home.js';
import * as install from './modules/install.js';
import * as marquee from './modules/marquee.js';
import * as player from './modules/player.js';
import * as router from './modules/router.js';
import * as serviceWorker from './modules/service-worker.js';
import * as update from './modules/update.js';

dialog.init('[data-dialog]');
marquee.init('[data-marquee]', { speed: 32, pause: 2.5 });
install.init('[data-install]');
update.init('[data-update]');
router.init('[data-view]', {
  views: {
    home: home.init('[data-view="home"]'),
    edit: editor.init('[data-view="editor"]'),
    timer: player.init('[data-view="timer"]', {
      tickInterval: 200,
      lookahead: 1000,
      stale: 500,
      restartAfter: 2000,
      wipeDuration: 320,
      flashDuration: 360,
      settleDuration: 900,
      pulseDuration: 320,
      segmentDuration: 220,
      segmentStagger: 90
    })
  }
});

window.addEventListener(
  'load',
  () =>
    serviceWorker.register('./service-worker.js', {
      checkInterval: 60 * 60 * 1000,
      bypassHosts: ['localhost', '127.0.0.1', '[::1]']
    }),
  { once: true }
);
