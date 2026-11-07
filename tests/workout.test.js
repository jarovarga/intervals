import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildSteps,
  createBlankWorkout,
  createExercise,
  createWorkout,
  duplicateWorkout,
  MAX_ROUNDS,
  readWorkout,
  totalSeconds
} from '../src/js/modules/workout.js';

/**
 * @param {Partial<import('../src/js/modules/workout.js').Workout>} [changes] What differs from the default workout.
 * @returns {import('../src/js/modules/workout.js').Workout} Two exercises of 40 and 20 seconds.
 */
const sample = (changes = {}) => ({
  ...createWorkout('Leg day', [createExercise('Squats', 40), createExercise('Lunges', 20)]),
  ...changes
});

test('a stored workout survives a JSON round trip unchanged', () => {
  const workout = sample({ intensity: 'high' });

  assert.deepEqual(readWorkout(JSON.parse(JSON.stringify(workout))), workout);
});

test('readWorkout repairs out-of-range values and drops unusable data', () => {
  const workout = sample();
  const repaired = readWorkout({
    ...workout,
    name: '   ',
    intensity: 'extreme',
    rounds: MAX_ROUNDS + 1,
    prepare: -1,
    rest: 1.5,
    exercises: [{ ...workout.exercises[0], time: 0 }, { id: '../bad', name: 'x', time: 30 }, null, 'text']
  });

  assert.equal(repaired.name, 'Workout');
  assert.equal(repaired.intensity, 'moderate');
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

test('a blank workout starts with one numbered exercise', () => {
  const workout = createBlankWorkout();

  assert.equal(workout.name, 'New workout');
  assert.deepEqual(
    workout.exercises.map(({ name }) => name),
    ['Exercise 1']
  );
});

test('a duplicate has new identifiers and the same content', () => {
  const workout = sample();
  const copy = duplicateWorkout(workout);

  assert.notEqual(copy.id, workout.id);
  assert.notEqual(copy.exercises[0].id, workout.exercises[0].id);
  assert.deepEqual(
    {
      ...copy,
      id: workout.id,
      exercises: copy.exercises.map((exercise, index) => ({ ...exercise, id: workout.exercises[index].id }))
    },
    workout
  );
});

test('the steps run get ready, then exercises with rest between them and a cooldown between rounds', () => {
  const steps = buildSteps(sample({ prepare: 10, rest: 15, rounds: 2, roundRest: 60 }));

  assert.deepEqual(
    steps.map(({ type, duration, exercise, round }) => [type, duration, exercise, round]),
    [
      ['prepare', 10, 0, 0],
      ['work', 40, 0, 0],
      ['rest', 15, 1, 0],
      ['work', 20, 1, 0],
      ['round', 60, 0, 1],
      ['work', 40, 0, 1],
      ['rest', 15, 1, 1],
      ['work', 20, 1, 1]
    ]
  );
});

test('steps without time are left out, and the total adds up every step', () => {
  const workout = sample({ prepare: 0, rest: 0, rounds: 3, roundRest: 30 });

  assert.equal(
    buildSteps(workout).some(({ type }) => type === 'prepare' || type === 'rest'),
    false
  );
  assert.equal(totalSeconds(workout), 3 * (40 + 20) + 2 * 30);
});
