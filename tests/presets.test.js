import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { setLanguage } from '../src/js/modules/i18n.js';
import { createFromPreset, createStarterWorkouts, PRESETS } from '../src/js/modules/presets.js';
import { buildSteps, readWorkout, totalSeconds } from '../src/js/modules/workout.js';

afterEach(() => setLanguage('en'));

test('every preset builds a valid workout with fresh identifiers', () => {
  PRESETS.forEach(({ id }) => {
    const workout = createFromPreset(id);

    assert.deepEqual(readWorkout(workout), workout);
    assert.notEqual(createFromPreset(id).id, workout.id);
  });

  assert.equal(createFromPreset('missing'), null);
});

test('Tabata runs eight different 20 s exercises with 10 s rest, four minutes with the get ready', () => {
  const workout = createFromPreset('tabata');
  const work = buildSteps(workout).filter(({ type }) => type === 'work');

  assert.equal(workout.name, 'Tabata');
  assert.equal(work.length, 8);
  assert.equal(new Set(workout.exercises.map(({ name }) => name)).size, 8);
  assert.ok(work.every(({ duration }) => duration === 20));
  assert.equal(workout.rest, 10);
  assert.equal(totalSeconds(workout), 4 * 60);
});

test('the 30/30 circuit runs nine 30 s exercises with 30 s rest', () => {
  const workout = createFromPreset('30-30');

  assert.equal(workout.name, '30/30 Circuit');
  assert.equal(workout.exercises.length, 9);
  assert.ok(workout.exercises.every(({ time }) => time === 30));
  assert.equal(totalSeconds(workout), 10 + 9 * 30 + 8 * 30);
});

test('exercise names follow the language in use', () => {
  setLanguage('sk');

  assert.equal(createFromPreset('30-30').exercises[0].name, 'Pomalý horolezec');
});

test('a new device starts with one workout of every preset', () => {
  assert.deepEqual(
    createStarterWorkouts().map(({ name }) => name),
    PRESETS.map(({ name }) => name)
  );
});
