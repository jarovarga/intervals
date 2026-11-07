import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import * as preferences from '../src/js/modules/preferences.js';
import { restoreGlobals, setGlobal } from './helpers/globals.js';
import { fakeStorage, storageEvent } from './helpers/storage.js';

const { DEFAULTS, MAX_COUNTDOWN, MAX_WEEKLY_GOAL, readPreferences } = preferences;
const KEY = 'intervals:preferences';

/** Window of the module under test; a `storage` event on it makes the module read storage again. */
const page = new EventTarget();

preferences.init(page);

/**
 * Give the module a storage and let it forget what it read before.
 *
 * @param {ReturnType<typeof fakeStorage>} storage Storage to use.
 * @returns {void}
 */
const useStorage = (storage) => {
  setGlobal('localStorage', storage);
  page.dispatchEvent(storageEvent(null));
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
  assert.deepEqual(JSON.parse(storage.items.get(KEY)), { version: 1, data: { ...DEFAULTS, weeklyGoal: 4 } });

  useStorage(storage);

  assert.equal(preferences.get().weeklyGoal, 4);
});

test('a reset returns every preference to its default', () => {
  preferences.update({ weeklyGoal: 5, language: 'sk', sound: false });

  assert.equal(preferences.reset(), true);
  assert.deepEqual(preferences.get(), DEFAULTS);
});
