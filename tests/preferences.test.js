import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import * as preferences from '../src/js/modules/preferences.js';
import { collectWarnings, restoreGlobals, setGlobal } from './helpers/globals.js';

const { DEFAULTS, MAX_COUNTDOWN, MAX_WEEKLY_GOAL, readPreferences } = preferences;
const KEY = 'intervals:preferences';
const BACKUP_KEY = 'intervals:preferences:backup';

/** Window of the module under test; a `storage` event on it makes the module read storage again. */
const page = new EventTarget();

preferences.init(page);

/**
 * A localStorage that keeps its items in a map and can refuse to write.
 *
 * @param {Record<string, string>} [items] What it holds to begin with.
 * @returns {{ items: Map<string, string>, full: boolean, getItem: Function, setItem: Function }} The store.
 */
const fakeStorage = (items = {}) => {
  const store = {
    items: new Map(Object.entries(items)),
    full: false,
    getItem: (key) => store.items.get(key) ?? null,
    setItem: (key, value) => {
      if (store.full) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');

      store.items.set(key, String(value));
    }
  };

  return store;
};

/**
 * Give the module a storage and let it forget what it read before.
 *
 * @param {ReturnType<typeof fakeStorage>} storage Storage to use.
 * @returns {void}
 */
const useStorage = (storage) => {
  setGlobal('localStorage', storage);
  page.dispatchEvent(Object.assign(new Event('storage'), { key: null }));
};

beforeEach(() => useStorage(fakeStorage()));
afterEach(() => restoreGlobals());

test('valid preferences are kept and the rest falls back', () => {
  const read = readPreferences({
    sound: false,
    volume: 0.4,
    playback: 'yes',
    countdown: MAX_COUNTDOWN + 1,
    keepAwake: false,
    weeklyGoal: MAX_WEEKLY_GOAL,
    language: 'de'
  });

  assert.deepEqual(read, {
    ...DEFAULTS,
    sound: false,
    volume: 0.4,
    keepAwake: false,
    weeklyGoal: MAX_WEEKLY_GOAL
  });
});

test('counts must be whole numbers in range, and the volume a fraction', () => {
  for (const countdown of [-1, 2.5, '3', null]) {
    assert.equal(readPreferences({ countdown }).countdown, DEFAULTS.countdown, String(countdown));
  }

  assert.equal(readPreferences({ countdown: 0 }).countdown, 0);
  assert.equal(readPreferences({ volume: 1.5 }).volume, DEFAULTS.volume);
  assert.equal(readPreferences({ volume: 0 }).volume, 0);
});

test('a chosen language is kept, and no choice stays null', () => {
  assert.equal(readPreferences({ language: 'sk' }).language, 'sk');
  assert.equal(readPreferences({ language: null }).language, null);
});

test('without stored preferences the defaults apply', () => {
  assert.deepEqual(preferences.get(), DEFAULTS);
});

test('a change is stored with the schema version, and a value out of range is ignored', () => {
  const storage = fakeStorage();

  useStorage(storage);

  assert.equal(preferences.update({ weeklyGoal: 4, countdown: MAX_COUNTDOWN + 1 }), true);
  assert.deepEqual(JSON.parse(storage.items.get(KEY)), { version: 1, ...DEFAULTS, weeklyGoal: 4 });

  useStorage(storage);

  assert.equal(preferences.get().weeklyGoal, 4);
});

test('unreadable or unknown preferences are backed up before the defaults apply', (context) => {
  collectWarnings(context);

  for (const raw of ['{not json', JSON.stringify({ version: 99, weeklyGoal: 2 })]) {
    const storage = fakeStorage({ [KEY]: raw });

    useStorage(storage);

    assert.deepEqual(preferences.get(), DEFAULTS);
    assert.equal(storage.items.get(BACKUP_KEY), raw);
  }
});

test('a change that cannot be stored lasts until the app closes', (context) => {
  const storage = fakeStorage();
  const warnings = collectWarnings(context);

  useStorage(storage);
  storage.full = true;

  assert.equal(preferences.update({ sound: false }), false);
  assert.equal(preferences.get().sound, false);
  assert.equal(warnings.length, 1);
});

// Runs last: once a backup has failed, the module keeps the stored data safe for the rest of the session.
test('when unreadable preferences cannot be backed up, nothing is written over them', (context) => {
  const storage = fakeStorage({ [KEY]: '{not json' });

  collectWarnings(context);
  useStorage(storage);
  storage.full = true;

  assert.deepEqual(preferences.get(), DEFAULTS);

  storage.full = false;

  assert.equal(preferences.update({ sound: false }), false);
  assert.equal(storage.items.get(KEY), '{not json');
});
