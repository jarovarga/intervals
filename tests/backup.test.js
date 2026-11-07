import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import { createBackup, fileName, readBackup, restore } from '../src/js/modules/backup.js';
import * as library from '../src/js/modules/library.js';
import * as preferences from '../src/js/modules/preferences.js';
import { createExercise, createWorkout } from '../src/js/modules/workout.js';
import { restoreGlobals, setGlobal } from './helpers/globals.js';
import { fakeStorage, storageEvent } from './helpers/storage.js';

/** Window of the modules under test; a `storage` event on it makes them read storage again. */
const page = new EventTarget();

library.init(page);
preferences.init(page);

/** Give the modules an empty device. */
const freshDevice = () => {
  setGlobal('localStorage', fakeStorage());
  setGlobal('navigator', { storage: { persist: async () => true } });
  page.dispatchEvent(storageEvent(null));
};

beforeEach(freshDevice);
afterEach(() => restoreGlobals());

const NOW = new Date('2026-11-07T09:30:00Z');

test('an export carries the preferences, the workouts and the log, and restores them on another device', () => {
  const workout = createWorkout('Leg day', [createExercise('Squats', 45)]);

  preferences.update({ weeklyGoal: 4, language: 'sk' });
  library.saveWorkout(workout);
  library.recordCompletion(workout, 1000);

  const text = JSON.stringify(createBackup(NOW));

  freshDevice();

  const backup = readBackup(text);

  assert.equal(backup.exportedAt, '2026-11-07T09:30:00.000Z');
  assert.deepEqual(restore(backup), { workouts: 1, completions: 1, saved: true });
  assert.equal(preferences.get().weeklyGoal, 4);
  assert.equal(preferences.get().language, 'sk');
  assert.deepEqual(library.getWorkouts(), [workout]);
});

test('only an export of this app in a known version is read', () => {
  for (const text of [
    '{not json',
    'null',
    '{}',
    JSON.stringify({ app: 'other', version: 1 }),
    JSON.stringify({ app: 'intervals', version: 2 })
  ]) {
    assert.equal(readBackup(text), null, text);
  }
});

test('an export without preferences keeps the current ones', () => {
  preferences.update({ weeklyGoal: 3 });

  assert.deepEqual(restore({ app: 'intervals', version: 1, workouts: [], completions: [] }), {
    workouts: 0,
    completions: 0,
    saved: true
  });
  assert.equal(preferences.get().weeklyGoal, 3);
});

test('the file name carries the date of the export', () => {
  assert.equal(fileName(NOW), 'intervals-2026-11-07.json');
});
