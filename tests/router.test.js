import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolve } from '../src/js/modules/router.js';

const SCREENS = ['workouts', 'health', 'log', 'settings', 'editor', 'timer'];

test('a fragment that names a screen shows that screen', () => {
  assert.equal(resolve('#log', SCREENS, 'workouts'), 'log');
  assert.equal(resolve('#timer', SCREENS, 'workouts'), 'timer');
});

test('an empty or unknown fragment shows the home screen', () => {
  assert.equal(resolve('', SCREENS, 'workouts'), 'workouts');
  assert.equal(resolve('#', SCREENS, 'workouts'), 'workouts');
  assert.equal(resolve('#app', SCREENS, 'workouts'), 'workouts');
});

test('a fragment must match a screen exactly', () => {
  assert.equal(resolve('#Log', SCREENS, 'workouts'), 'workouts');
  assert.equal(resolve('#log/extra', SCREENS, 'workouts'), 'workouts');
});
