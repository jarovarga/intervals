import assert from 'node:assert/strict';
import { test } from 'node:test';

import { arcPath, layout, segments } from '../src/js/modules/ring.js';
import { createExercise, createWorkout } from '../src/js/modules/workout.js';

const WIDTH = 3.8;

/**
 * @param {number} rest Seconds of rest between exercises.
 * @returns {import('../src/js/modules/workout.js').Workout} Exercises of 45, 30 and 60 seconds.
 */
const sample = (rest) => ({
  ...createWorkout('Sample', [createExercise('A', 45), createExercise('B', 30), createExercise('C', 60)]),
  rest
});

test('a round has a segment for every exercise and every rest between them', () => {
  assert.deepEqual(segments(sample(15)), [45, 15, 30, 15, 60]);
  assert.deepEqual(segments(sample(0)), [45, 30, 60]);
});

test('the arcs keep the order and the shares of their segments, with gaps between them', () => {
  const arcs = layout([30, 10, 60], WIDTH);

  assert.equal(arcs.length, 3);
  assert.ok(arcs.every(({ start }, index) => index === 0 || start > arcs[index - 1].start + arcs[index - 1].length));
  // A segment twice as long draws an arc that is longer by its share of the circumference.
  assert.ok(Math.abs(arcs[2].length - arcs[0].length - 30) < 1e-9);

  const last = arcs.at(-1);

  assert.ok(last.start + last.length < 100);
});

test('a single segment fills the ring but for its gap', () => {
  const [arc] = layout([60], WIDTH);

  assert.ok(arc.length > 90 && arc.length < 100);
});

test('nothing is drawn for no time, and a tiny segment keeps a minimal length', () => {
  assert.deepEqual(layout([], WIDTH), []);
  assert.deepEqual(layout([0, 0], WIDTH), []);
  assert.ok(layout([1, 1000], WIDTH)[0].length > 0);
});

test('an arc starts at the top and runs clockwise', () => {
  const radius = 50 - WIDTH / 2;

  // Coordinates are rounded to three decimals: 50 − 48.1 = 1.9.
  assert.equal(arcPath({ start: 0, length: 25 }, WIDTH), `M 50 1.9 A ${radius} ${radius} 0 0 1 98.1 50`);
  assert.match(arcPath({ start: 0, length: 75 }, WIDTH), / 0 1 1 /);
});
