import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { createDefaultWorkout } from '../src/js/modules/workout.js';

const KEY = 'intervals:v1';
const BACKUP_KEY = `${KEY}:backup`;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

let imports = 0;

/**
 * Install an in-memory localStorage; keys listed in `failing` throw on write, as a full store does.
 *
 * @param {Record<string, string>} data Initial contents.
 * @param {string[]} failing Keys whose writes throw.
 * @returns {Map<string, string>} The backing map.
 */
const fakeStorage = (data = {}, failing = []) => {
  const map = new Map(Object.entries(data));

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => {
        if (failing.includes(key)) {
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        }

        map.set(key, value);
      }
    }
  });

  return map;
};

/** The module keeps its library in module state, so every test loads a fresh copy. */
const loadLibrary = () => {
  imports += 1;

  return import(`../src/js/modules/library.js?test=${imports}`);
};

afterEach(() => {
  if (originalStorage) {
    Object.defineProperty(globalThis, 'localStorage', originalStorage);
  } else {
    delete globalThis.localStorage;
  }
});

test('saved workouts are written to storage and read back', async () => {
  const map = fakeStorage();
  const workout = createDefaultWorkout();
  const library = await loadLibrary();

  library.saveWorkout(workout);

  const reloaded = await loadLibrary();

  assert.deepEqual(reloaded.getWorkout(workout.id), workout);
  assert.equal(JSON.parse(map.get(KEY)).version, 1);
});

test('unreadable data is backed up before the library starts empty', async () => {
  const map = fakeStorage({ [KEY]: '{not json' });
  const library = await loadLibrary();

  assert.deepEqual(library.getWorkouts(), []);
  assert.equal(map.get(BACKUP_KEY), '{not json');
  assert.equal(JSON.parse(map.get(KEY)).workouts.length, 0);
});

test('data of an unknown version is backed up before the library starts empty', async () => {
  const stored = JSON.stringify({ version: 2, sound: false, workouts: [createDefaultWorkout()] });
  const map = fakeStorage({ [KEY]: stored });
  const library = await loadLibrary();

  assert.deepEqual(library.getWorkouts(), []);
  assert.equal(map.get(BACKUP_KEY), stored);
});

test('unreadable data is never overwritten when the backup fails', async () => {
  const map = fakeStorage({ [KEY]: '{not json' }, [BACKUP_KEY]);
  const library = await loadLibrary();

  library.saveWorkout(createDefaultWorkout());
  library.setSoundOn(false);

  assert.equal(map.get(KEY), '{not json');
  assert.equal(library.getWorkouts().length, 1);
});

test('unusable workouts are dropped while the usable ones are kept', async () => {
  const workout = createDefaultWorkout();

  fakeStorage({ [KEY]: JSON.stringify({ version: 1, sound: false, workouts: [workout, null, 'text'] }) });

  const library = await loadLibrary();

  assert.deepEqual(library.getWorkouts(), [workout]);
  assert.equal(library.isSoundOn(), false);
});

test('persistent storage is requested once, after the first saved workout', async () => {
  fakeStorage();

  let requests = 0;
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      storage: {
        persist: async () => {
          requests += 1;

          return true;
        }
      }
    }
  });

  try {
    const library = await loadLibrary();

    assert.equal(requests, 0);

    library.saveWorkout(createDefaultWorkout());
    library.saveWorkout(createDefaultWorkout());

    assert.equal(requests, 1);
  } finally {
    Object.defineProperty(globalThis, 'navigator', original);
  }
});

test('a failing write keeps the library working in memory', async () => {
  fakeStorage({}, [KEY]);

  const library = await loadLibrary();
  const warn = console.warn;

  console.warn = () => {};

  try {
    library.saveWorkout(createDefaultWorkout());
  } finally {
    console.warn = warn;
  }

  assert.equal(library.getWorkouts().length, 1);
});
