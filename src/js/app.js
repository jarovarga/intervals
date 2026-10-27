import * as dialog from './modules/dialog.js';
import * as editor from './modules/editor.js';
import * as home from './modules/home.js';
import * as install from './modules/install.js';
import * as player from './modules/player.js';
import * as router from './modules/router.js';
import * as serviceWorker from './modules/service-worker.js';

dialog.init('[data-dialog]');
install.init('[data-install]');
router.init('[data-view]', {
  views: {
    home: home.init('[data-view="home"]'),
    edit: editor.init('[data-view="editor"]'),
    timer: player.init('[data-view="timer"]')
  }
});

window.addEventListener('load', () => serviceWorker.register(), { once: true });
