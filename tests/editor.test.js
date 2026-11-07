import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyPreset, findProblem } from '../src/js/modules/editor.js';
import { createFromPreset } from '../src/js/modules/presets.js';
import { createExercise, createWorkout } from '../src/js/modules/workout.js';

const draft = (name, exercises) => createWorkout(name, exercises);

test('a workout needs a name, an exercise and a name for every exercise', () => {
  const squats = createExercise('Squats', 30);
  const blank = createExercise('  ', 30);

  assert.equal(findProblem(draft(' ', [squats])).message, 'editor.enterName');
  assert.equal(findProblem(draft('Leg day', [])).field, 'add');
  assert.deepEqual(findProblem(draft('Leg day', [squats, blank])), {
    message: 'editor.nameEvery',
    field: 'exercise-name',
    exercise: blank.id
  });
  assert.equal(findProblem(draft('Leg day', [squats])), null);
});

test('a preset fills a new workout with its name, and an existing one keeps its own', () => {
  const tabata = createFromPreset('tabata');
  const existing = draft('Leg day', [createExercise('Squats', 45)]);

  const filledNew = applyPreset(existing, tabata, true);
  const filledExisting = applyPreset(existing, tabata, false);

  assert.equal(filledNew.name, 'Tabata');
  assert.equal(filledExisting.name, 'Leg day');
  assert.equal(filledExisting.id, existing.id);
  assert.equal(filledExisting.exercises.length, 8);
  assert.equal(filledExisting.rest, 10);
  assert.equal(filledExisting.intensity, 'high');
});
