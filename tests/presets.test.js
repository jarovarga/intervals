import assert from 'node:assert/strict';
import { test } from 'node:test';

import { copyPreset, getPreset, getPresets } from '../src/js/modules/presets.js';
import { readWorkout, totalSeconds } from '../src/js/modules/workout.js';

test('every preset is a valid workout with a unique identifier', () => {
  const presets = getPresets();

  assert.equal(new Set(presets.map((preset) => preset.id)).size, presets.length);

  presets.forEach((preset) => {
    assert.deepEqual(readWorkout(preset), preset);
  });
});

test('a preset is found by its identifier', () => {
  assert.equal(getPreset('preset-tabata')?.name, 'Tabata');
  assert.equal(getPreset('missing'), undefined);
});

test('Tabata runs eight 20 s exercises with 10 s between them after the countdown', () => {
  const workout = getPreset('preset-tabata');
  const COUNTDOWN = workout.prepare;
  const EXERCISES = 8;
  const WORK = 20;
  const REST = 10;

  assert.equal(workout.exercises.length, EXERCISES);
  assert.equal(totalSeconds(workout), COUNTDOWN + EXERCISES * WORK + (EXERCISES - 1) * REST);
});

test('a copy of a preset has a new identifier and leaves the preset unchanged', () => {
  const preset = getPreset('preset-tabata');
  const copy = copyPreset(preset.id);

  assert.notEqual(copy.id, preset.id);
  assert.deepEqual({ ...copy, id: preset.id }, preset);

  copy.exercises[0].name = 'Changed';

  assert.notEqual(preset.exercises[0].name, 'Changed');
  assert.equal(copyPreset('missing'), undefined);
});
