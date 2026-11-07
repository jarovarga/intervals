import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { collectWarnings, fakeDocument, restoreGlobals, setGlobal } from './helpers/globals.js';

let imports = 0;

/** The module keeps its lock in module state, so every test loads a fresh copy. */
const loadWakeLock = () => {
  imports += 1;

  return import(`../src/js/modules/wake-lock.js?test=${imports}`);
};

/**
 * A browser that hands out wake locks and remembers what was asked of it.
 *
 * @param {{ fails?: boolean, manual?: boolean }} [options] A request that fails, or one that waits to be answered by hand.
 * @returns {{ requests: string[], locks: object[], answer: () => void }} What the browser saw and gave out.
 */
const fakeBrowser = ({ fails = false, manual = false } = {}) => {
  const requests = [];
  const locks = [];
  let answer = () => {};

  const createLock = () => {
    const listeners = [];
    const lock = {
      released: false,
      addEventListener: (type, listener) => listeners.push(listener),
      release: async () => {
        lock.released = true;
        listeners.forEach((listener) => listener());
      }
    };

    locks.push(lock);

    return lock;
  };

  setGlobal('navigator', {
    wakeLock: {
      request: (type) => {
        requests.push(type);

        if (fails) return Promise.reject(new Error('Not allowed'));

        const lock = createLock();

        return manual ? new Promise((resolve) => (answer = () => resolve(lock))) : Promise.resolve(lock);
      }
    }
  });

  return { requests, locks, answer: () => answer() };
};

afterEach(restoreGlobals);

test('the screen lock is requested once however often it is asked for', async () => {
  const browser = fakeBrowser();
  const wakeLock = await loadWakeLock();

  await wakeLock.acquire();
  await wakeLock.acquire();

  assert.deepEqual(browser.requests, ['screen']);
});

test('a forbidden screen lock is not requested, and forbidding it lets go of a held one', async () => {
  const browser = fakeBrowser();
  const wakeLock = await loadWakeLock();

  await wakeLock.acquire();
  await wakeLock.setEnabled(false);

  assert.equal(browser.locks[0].released, true);

  await wakeLock.acquire();

  assert.equal(browser.requests.length, 1);

  await wakeLock.setEnabled(true);
  await wakeLock.acquire();

  assert.equal(browser.requests.length, 2);
});

test('without wake lock support asking for it does nothing', async () => {
  setGlobal('navigator', {});

  const wakeLock = await loadWakeLock();

  await assert.doesNotReject(wakeLock.acquire());
  await assert.doesNotReject(wakeLock.release());
});

test('releasing lets the screen sleep and a later request asks again', async () => {
  const browser = fakeBrowser();
  const wakeLock = await loadWakeLock();

  await wakeLock.acquire();
  await wakeLock.release();

  assert.equal(browser.locks[0].released, true);

  await wakeLock.acquire();

  assert.equal(browser.requests.length, 2);
});

test('a lock that arrives after the workout was released is let go at once', async () => {
  const browser = fakeBrowser({ manual: true });
  const wakeLock = await loadWakeLock();
  const pending = wakeLock.acquire();

  await wakeLock.release();
  browser.answer();
  await pending;

  assert.equal(browser.locks[0].released, true);
});

test('a refused request is reported and the next one is tried', async (context) => {
  const warnings = collectWarnings(context);
  const browser = fakeBrowser({ fails: true });
  const wakeLock = await loadWakeLock();

  await wakeLock.acquire();
  await wakeLock.acquire();

  assert.equal(browser.requests.length, 2);
  assert.deepEqual(warnings, ['The screen could not be kept awake.', 'The screen could not be kept awake.']);
});

test('a lock that cannot be released is reported and the app carries on', async (context) => {
  const warnings = collectWarnings(context);
  const browser = fakeBrowser();
  const wakeLock = await loadWakeLock();

  await wakeLock.acquire();
  browser.locks[0].release = () => Promise.reject(new Error('Gone'));

  await assert.doesNotReject(wakeLock.release());
  assert.deepEqual(warnings, ['The screen lock could not be released.']);
});

test('the lock is requested again once the page is visible after the browser dropped it', async () => {
  const page = fakeDocument();

  setGlobal('document', page);

  const browser = fakeBrowser();
  const wakeLock = await loadWakeLock();

  wakeLock.init();
  await wakeLock.acquire();

  // The browser drops the lock when the page is hidden.
  page.hide();
  await browser.locks[0].release();
  page.show();
  await Promise.resolve();

  assert.equal(browser.requests.length, 2);
});

test('the lock is not requested again when no workout wants the screen on', async () => {
  const page = fakeDocument();

  setGlobal('document', page);

  const browser = fakeBrowser();
  const wakeLock = await loadWakeLock();

  wakeLock.init();
  page.show();

  assert.equal(browser.requests.length, 0);

  await wakeLock.acquire();
  await wakeLock.release();
  page.show();

  assert.equal(browser.requests.length, 1);
});
