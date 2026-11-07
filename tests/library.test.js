import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import * as library from '../src/js/modules/library.js';
import { createExercise, createWorkout, totalSeconds } from '../src/js/modules/workout.js';
import { restoreGlobals, setGlobal } from './helpers/globals.js';
import { fakeStorage, storageEvent } from './helpers/storage.js';

const HOUR = 60 * 60 * 1000;

/** Window of the module under test; a `storage` event on it makes the module read storage again. */
const page = new EventTarget();

library.init(page);

/**
 * Give the module a storage and let it forget what it read before.
 *
 * @param {ReturnType<typeof fakeStorage>} [storage] Storage to use.
 * @returns {ReturnType<typeof fakeStorage>} The storage.
 */
const useStorage = (storage = fakeStorage()) => {
  setGlobal('localStorage', storage);
  setGlobal('navigator', { storage: { persist: async () => true } });
  page.dispatchEvent(storageEvent(null));

  return storage;
};

/**
 * @param {string} name Workout name.
 * @returns {import('../src/js/modules/workout.js').Workout} A workout with one 30 s exercise.
 */
const sample = (name) => createWorkout(name, [createExercise('Squats', 30)]);

beforeEach(() => useStorage());
afterEach(() => restoreGlobals());

test('a saved workout is added at the end, and saving it again replaces it in its place', () => {
  const first = sample('First');
  const second = sample('Second');

  assert.equal(library.saveWorkout(first), true);
  assert.equal(library.saveWorkout(second), true);
  assert.equal(library.saveWorkout({ ...first, name: 'Renamed' }), true);

  assert.deepEqual(
    library.getWorkouts().map(({ name }) => name),
    ['Renamed', 'Second']
  );
  assert.equal(library.getWorkout(second.id).name, 'Second');
});

test('a new workout can follow another one, such as a copy after its original', () => {
  const [first, second, copy] = [sample('First'), sample('Second'), sample('Copy')];

  library.saveWorkout(first);
  library.saveWorkout(second);
  library.saveWorkout(copy, { after: first.id });

  assert.deepEqual(
    library.getWorkouts().map(({ name }) => name),
    ['First', 'Copy', 'Second']
  );
});

test('saved workouts survive a reload', () => {
  const storage = useStorage();
  const workout = sample('Leg day');

  library.saveWorkout(workout);
  useStorage(storage);

  assert.deepEqual(library.getWorkouts(), [workout]);
});

test('deleting all workouts keeps the log', () => {
  const workout = sample('Leg day');

  library.saveWorkout(workout);
  library.recordCompletion(workout, 1000);

  assert.equal(library.clearWorkouts(), true);
  assert.deepEqual(library.getWorkouts(), []);
  assert.equal(library.getCompletions().length, 1);
});

test('deleting all data removes the workouts, the log and the progress', () => {
  const workout = sample('Leg day');

  library.saveWorkout(workout);
  library.recordCompletion(workout, 1000);
  library.saveSession({ id: workout.id, elapsed: 0, savedAt: 1000 });

  assert.equal(library.clearAll(), true);
  assert.deepEqual(library.getWorkouts(), []);
  assert.deepEqual(library.getCompletions(), []);
  assert.equal(library.loadSession(1000), null);
});

test('a new device gets its first workouts once, and a device that deleted them stays empty', () => {
  const storage = useStorage();

  library.seed([sample('Starter')]);
  library.seed([sample('Again')]);

  assert.deepEqual(
    library.getWorkouts().map(({ name }) => name),
    ['Starter']
  );

  library.clearAll();
  useStorage(storage);
  library.seed([sample('Starter')]);

  assert.deepEqual(library.getWorkouts(), []);
});

test('a finished workout is logged with its name and length as they were', () => {
  const workout = sample('Leg day');

  library.recordCompletion(workout, 5000);
  library.saveWorkout({ ...workout, name: 'Renamed' });

  assert.deepEqual(library.getCompletions(), [
    { id: workout.id, name: 'Leg day', at: 5000, seconds: totalSeconds(workout) }
  ]);
});

test('the progress of a workout can be picked up for an hour', () => {
  const progress = { id: 'abc', elapsed: 42_000, savedAt: 1_000_000 };

  library.saveSession(progress);

  assert.deepEqual(library.loadSession(progress.savedAt + HOUR), progress);
  assert.equal(library.loadSession(progress.savedAt + HOUR + 1), null);

  library.clearSession();

  assert.equal(library.loadSession(progress.savedAt), null);
});

test('an import adds workouts as copies when their identifiers are taken, and skips logged completions', () => {
  const workout = sample('Leg day');

  library.saveWorkout(workout);
  library.recordCompletion(workout, 1000);

  const result = library.importData({
    workouts: [workout, sample('Core'), { id: 'bad id' }],
    completions: [
      { id: workout.id, name: 'Leg day', at: 1000, seconds: 40 },
      { id: workout.id, name: 'Leg day', at: 500, seconds: 40 },
      { id: 'x', name: 'Broken', at: 'yesterday', seconds: 40 }
    ]
  });

  assert.deepEqual(result, { workouts: 2, completions: 1, saved: true });
  assert.equal(library.getWorkouts().length, 3);
  assert.equal(new Set(library.getWorkouts().map(({ id }) => id)).size, 3);
  assert.deepEqual(
    library.getCompletions().map(({ at }) => at),
    [500, 1000]
  );
});

test('an export carries the workouts and the log', () => {
  const workout = sample('Leg day');

  library.saveWorkout(workout);
  library.recordCompletion(workout, 1000);

  const data = library.exportData();

  assert.deepEqual(data.workouts, [workout]);
  assert.equal(data.completions.length, 1);
});
