import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createDefaultWorkout, MAX_ROUNDS, readWorkout } from '../src/js/modules/workout.js';

test('a stored workout survives a JSON round trip unchanged', () => {
  const workout = createDefaultWorkout();

  assert.deepEqual(readWorkout(JSON.parse(JSON.stringify(workout))), workout);
});

test('readWorkout repairs out-of-range values and drops unusable data', () => {
  const workout = createDefaultWorkout();
  const repaired = readWorkout({
    ...workout,
    name: '   ',
    colour: 'brown',
    rounds: MAX_ROUNDS + 1,
    prepare: -1,
    rest: 1.5,
    exercises: [{ ...workout.exercises[0], time: 0 }, { id: '../bad', name: 'x', time: 30 }, null, 'text']
  });

  assert.equal(repaired.name, 'Workout');
  assert.equal(repaired.colour, 'green');
  assert.equal(repaired.rounds, 1);
  assert.equal(repaired.prepare, 10);
  assert.equal(repaired.rest, 30);
  assert.equal(repaired.exercises.length, 1);
  assert.equal(repaired.exercises[0].time, 30);
});

test('readWorkout rejects values that are not workouts', () => {
  for (const value of [null, undefined, 'text', 5, {}, { id: 'a b' }]) {
    assert.equal(readWorkout(value), null);
  }
});
