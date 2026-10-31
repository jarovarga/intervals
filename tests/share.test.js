import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { createLink, readLink, send } from '../src/js/modules/share.js';
import { createDefaultWorkout, createWorkout } from '../src/js/modules/workout.js';
import { restoreGlobals, setGlobal } from './helpers/globals.js';

const BASE = 'https://example.test/intervals/';

afterEach(restoreGlobals);

const hashOf = (link) => new URL(link).hash;

test('a shared workout comes back with the same content and new identifiers', () => {
  const original = createWorkout(['Čučoriedky 💪', 'Plank'], 'Ráno');

  original.rounds = 3;
  original.colour = 'purple';

  const copy = readLink(hashOf(createLink(original, BASE)));

  assert.notEqual(copy.id, original.id);
  assert.deepEqual(
    { ...copy, id: null, exercises: copy.exercises.map(({ name, time }) => ({ name, time })) },
    { ...original, id: null, exercises: original.exercises.map(({ name, time }) => ({ name, time })) }
  );
  assert.equal(new Set(copy.exercises.map((exercise) => exercise.id)).size, 2);
});

test('a link carries no identifier of the sender', () => {
  const workout = createDefaultWorkout();
  const link = createLink(workout, BASE);

  assert.ok(link.startsWith(`${BASE}#share=`));
  assert.ok(!link.includes(workout.id));
});

test('a workout too large for a link is not shared', () => {
  const workout = createWorkout(
    Array.from({ length: 400 }, (_, index) => `Exercise number ${index}`),
    'Huge'
  );

  assert.equal(createLink(workout, BASE), null);
});

test('a hash that holds no usable workout is ignored', () => {
  const encode = (value) => `#share=${btoa(JSON.stringify(value)).replaceAll('=', '')}`;

  assert.equal(readLink(''), null);
  assert.equal(readLink('#/edit/abc'), null);
  assert.equal(readLink('#share='), null);
  assert.equal(readLink('#share=%%%'), null);
  assert.equal(readLink('#share=bm90IGpzb24'), null);
  assert.equal(readLink(encode(null)), null);
  assert.equal(readLink(encode({ name: 'No exercises', exercises: [] })), null);
  assert.equal(readLink(`#share=${'A'.repeat(8001)}`), null);
});

test('a shared workout is repaired like a stored one', () => {
  const hash = `#share=${btoa(JSON.stringify({ name: ' x '.repeat(40), colour: 'red', rounds: 500, exercises: [{ name: 'Run', time: -4 }] })).replaceAll('=', '')}`;
  const workout = readLink(hash);

  assert.equal(workout.colour, 'green');
  assert.equal(workout.rounds, 1);
  assert.equal(workout.name.length <= 50, true);
  assert.equal(workout.exercises[0].time, 30);
});

test('the share sheet is used where the device has one', async () => {
  const shared = [];

  setGlobal('location', { origin: 'https://example.test', pathname: '/intervals/' });
  setGlobal('navigator', { share: async (data) => shared.push(data) });

  assert.equal(await send(createDefaultWorkout()), 'shared');
  assert.equal(shared[0].title, '30/30 MIIT');
  assert.ok(shared[0].url.startsWith(BASE));
});

test('closing the share sheet is not an error and copies nothing', async () => {
  const copied = [];

  setGlobal('location', { origin: 'https://example.test', pathname: '/intervals/' });
  setGlobal('navigator', {
    share: async () => {
      throw new DOMException('Closed', 'AbortError');
    },
    clipboard: { writeText: async (text) => copied.push(text) }
  });

  assert.equal(await send(createDefaultWorkout()), 'cancelled');
  assert.deepEqual(copied, []);
});

test('the link is copied where there is no share sheet', async () => {
  const copied = [];

  setGlobal('location', { origin: 'https://example.test', pathname: '/intervals/' });
  setGlobal('navigator', { clipboard: { writeText: async (text) => copied.push(text) } });

  assert.equal(await send(createDefaultWorkout()), 'copied');
  assert.ok(copied[0].startsWith(`${BASE}#share=`));
});

test('a refused copy is reported', async () => {
  setGlobal('location', { origin: 'https://example.test', pathname: '/intervals/' });
  setGlobal('navigator', {
    clipboard: {
      writeText: async () => {
        throw new DOMException('Denied', 'NotAllowedError');
      }
    }
  });

  const warn = console.warn;

  console.warn = () => {};

  try {
    assert.equal(await send(createDefaultWorkout()), 'failed');
  } finally {
    console.warn = warn;
  }
});
