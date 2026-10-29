import assert from 'node:assert/strict';
import { test } from 'node:test';

import { describeNext, PHASE_LABELS } from '../src/js/modules/phase.js';
import { buildSteps, createDefaultWorkout } from '../src/js/modules/workout.js';

const MS = 1000;

/** The default workout with its steps, names and length, which is what the timer hands over. */
const situation = (workout = createDefaultWorkout()) => {
  const steps = buildSteps(workout);
  const total = steps.reduce((sum, step) => sum + step.duration * MS, 0);

  return { steps, names: workout.exercises.map((exercise) => exercise.name), total };
};

test('the countdown is followed by the first exercise', () => {
  const next = describeNext({ ...situation(), index: 0, finished: false });

  assert.deepEqual(next, {
    phase: 'work',
    heading: 'Up next',
    title: 'Slow mountain climber',
    sub: 'Exercise 1 of 9',
    then: ''
  });
});

test('an exercise is followed by a counted rest', () => {
  const next = describeNext({ ...situation(), index: 1, finished: false });

  assert.equal(next.phase, 'rest');
  assert.equal(next.title, `${PHASE_LABELS.rest} :30`);
  assert.equal(next.sub, 'Rest 1 of 8');
  assert.equal(next.then, '');
});

test('a rest is followed by the next exercise', () => {
  const next = describeNext({ ...situation(), index: 2, finished: false });

  assert.equal(next.phase, 'work');
  assert.equal(next.title, 'Bodyweight squat (air squat)');
  assert.equal(next.sub, 'Exercise 2 of 9');
});

test('a cooldown names the exercise that starts the next round', () => {
  const workout = { ...createDefaultWorkout(), rounds: 2 };
  const { steps, names, total } = situation(workout);
  const beforeCooldown = steps.findIndex((step) => step.type === 'round') - 1;
  const next = describeNext({ steps, names, total, index: beforeCooldown, finished: false });

  assert.equal(next.phase, 'round');
  assert.equal(next.title, `${PHASE_LABELS.round} 1:00`);
  assert.equal(next.sub, 'Then ');
  assert.equal(next.then, 'Slow mountain climber');
});

test('the last step has nothing after it', () => {
  const { steps, names, total } = situation();
  const next = describeNext({ steps, names, total, index: steps.length - 1, finished: false });

  assert.deepEqual(next, {
    phase: 'done',
    heading: 'Up next',
    title: 'End of workout',
    sub: 'Final interval',
    then: ''
  });
});

test('a finished workout is summed up with its exercises and length', () => {
  const next = describeNext({ ...situation(), index: 0, finished: true });

  assert.equal(next.heading, 'Workout complete');
  assert.equal(next.title, 'Well done');
  // The count joins its number and word with a non-breaking space.
  assert.match(next.sub, /^9\sexercises · 8:40$/u);
  assert.equal(next.phase, 'work');
});
