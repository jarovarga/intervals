import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { createDefaultWorkout } from '../src/js/modules/workout.js';

const KEY = 'intervals:v1';
const BACKUP_KEY = `${KEY}:backup`;
const SESSION_KEY = `${KEY}:session`;
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
      },
      removeItem: (key) => {
        map.delete(key);
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

test('workout progress is saved, read back and cleared', async () => {
  const map = fakeStorage();
  const library = await loadLibrary();
  const session = { id: 'abc', elapsed: 42000, savedAt: 1700000000000 };

  library.saveSession(session);

  assert.deepEqual(library.loadSession(session.savedAt), session);

  library.clearSession();

  assert.equal(map.has(SESSION_KEY), false);
  assert.equal(library.loadSession(session.savedAt), null);
});

test('progress is picked up for an hour and not after', async () => {
  fakeStorage();

  const library = await loadLibrary();
  const hour = 60 * 60 * 1000;
  const session = { id: 'abc', elapsed: 42000, savedAt: 1700000000000 };

  library.saveSession(session);

  assert.deepEqual(library.loadSession(session.savedAt + hour), session);
  assert.equal(library.loadSession(session.savedAt + hour + 1), null);
});

test('unreadable or incomplete progress counts as none', async () => {
  const library = await loadLibrary();

  for (const stored of [
    '{not json',
    '"text"',
    JSON.stringify({ id: 'abc' }),
    JSON.stringify({ id: 1, elapsed: 5, savedAt: 1 })
  ]) {
    fakeStorage({ [SESSION_KEY]: stored });

    assert.equal(library.loadSession(1), null, stored);
  }
});

test('progress that cannot be stored costs only the resume', async () => {
  fakeStorage({}, [SESSION_KEY]);

  const library = await loadLibrary();

  library.saveSession({ id: 'abc', elapsed: 1000, savedAt: 1 });

  assert.equal(library.loadSession(1), null);
});

test('settings default to sound on, full volume, a three second countdown and the screen kept on', async () => {
  fakeStorage();

  const library = await loadLibrary();

  assert.deepEqual(library.getSettings(), { sound: true, volume: 1, countdown: 3, keepAwake: true });
});

test('changed settings are stored, and a value out of range is ignored', async () => {
  const map = fakeStorage();
  const library = await loadLibrary();

  library.updateSettings({ volume: 0.4, countdown: 5, keepAwake: false });
  library.updateSettings({ volume: 4, countdown: 9 });

  const reloaded = await loadLibrary();

  assert.deepEqual(reloaded.getSettings(), { sound: true, volume: 0.4, countdown: 5, keepAwake: false });
  assert.equal(JSON.parse(map.get(KEY)).countdown, 5);
});

test('a library saved before the settings existed gets their defaults', async () => {
  fakeStorage({ [KEY]: JSON.stringify({ version: 1, sound: false, workouts: [] }) });

  const library = await loadLibrary();

  assert.deepEqual(library.getSettings(), { sound: false, volume: 1, countdown: 3, keepAwake: true });
});

test('an import adds a workout that is already saved as a copy with a new identifier', async () => {
  fakeStorage();

  const library = await loadLibrary();
  const workout = createDefaultWorkout();

  library.saveWorkout(workout);

  const exported = JSON.stringify(library.exportWorkouts());

  library.saveWorkout({ ...workout, name: 'Changed' });
  fakeStorage();

  const other = await loadLibrary();

  assert.equal(other.importWorkouts(exported), 1);
  assert.equal(other.importWorkouts(exported), 1);

  const [first, second] = other.getWorkouts();

  assert.equal(first.id, workout.id);
  assert.notEqual(second.id, workout.id);
  assert.deepEqual({ ...second, id: workout.id }, workout);
});

test('a file that is not an export is refused and nothing is imported', async () => {
  fakeStorage();

  const library = await loadLibrary();

  assert.equal(library.importWorkouts('{not json'), null);
  assert.equal(library.importWorkouts(JSON.stringify({ version: 2, workouts: [] })), null);
  assert.equal(library.importWorkouts(JSON.stringify({ version: 1, workouts: 'x' })), null);
  assert.deepEqual(library.getWorkouts(), []);
});

test('deleting the workouts also drops the saved progress and keeps the settings', async () => {
  fakeStorage();

  const library = await loadLibrary();
  const workout = createDefaultWorkout();

  library.saveWorkout(workout);
  library.saveSession({ id: workout.id, elapsed: 5, savedAt: Date.now() });
  library.updateSettings({ countdown: 1 });
  library.clearWorkouts();

  assert.deepEqual(library.getWorkouts(), []);
  assert.equal(library.loadSession(), null);
  assert.equal(library.getSettings().countdown, 1);
});

test('an export of chosen workouts holds only those, and an import takes them back', async () => {
  fakeStorage();

  const library = await loadLibrary();
  const workout = createDefaultWorkout();

  library.saveWorkout(createDefaultWorkout());

  const exported = library.exportWorkouts([workout]);

  assert.deepEqual(exported.workouts, [workout]);

  fakeStorage();

  const other = await loadLibrary();

  assert.equal(other.importWorkouts(JSON.stringify(exported)), 1);
  assert.deepEqual(other.getWorkouts(), [workout]);
});
