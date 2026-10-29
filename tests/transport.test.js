import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as transport from '../src/js/modules/transport.js';

test('a new clock is stopped at the position it was given', () => {
  assert.deepEqual(transport.create(), { elapsedBefore: 0, resumedAt: null });
  assert.equal(transport.isRunning(transport.create(5000)), false);
  assert.equal(transport.elapsed(transport.create(5000), 99999), 5000);
});

test('a running clock adds the time since it was started', () => {
  const clock = transport.start(transport.create(2000), 10000);

  assert.equal(transport.isRunning(clock), true);
  assert.equal(transport.elapsed(clock, 10000), 2000);
  assert.equal(transport.elapsed(clock, 13500), 5500);
});

test('starting a clock that already runs leaves it as it is', () => {
  const clock = transport.start(transport.create(), 1000);

  assert.equal(transport.start(clock, 9000), clock);
});

test('pausing holds the time reached however long the clock stays stopped', () => {
  const clock = transport.pause(transport.start(transport.create(1000), 5000), 8000);

  assert.equal(transport.isRunning(clock), false);
  assert.equal(transport.elapsed(clock, 8000), 4000);
  assert.equal(transport.elapsed(clock, 60000), 4000);
});

test('the time of several runs adds up', () => {
  let clock = transport.start(transport.create(), 0);

  clock = transport.pause(clock, 3000);
  clock = transport.start(clock, 10000);

  assert.equal(transport.elapsed(clock, 12000), 5000);
});

test('jumping moves a running clock and keeps it running', () => {
  const clock = transport.jumpTo(transport.start(transport.create(), 1000), 30000, 7000);

  assert.equal(transport.isRunning(clock), true);
  assert.equal(transport.elapsed(clock, 7000), 30000);
  assert.equal(transport.elapsed(clock, 9000), 32000);
});

test('jumping moves a stopped clock and keeps it stopped', () => {
  const clock = transport.jumpTo(transport.create(4000), 30000, 7000);

  assert.equal(transport.isRunning(clock), false);
  assert.equal(transport.elapsed(clock, 99999), 30000);
});

test('the functions leave the clock they are given untouched', () => {
  const clock = Object.freeze(transport.create(1000));

  assert.doesNotThrow(() => {
    transport.start(clock, 5);
    transport.pause(clock, 5);
    transport.jumpTo(clock, 10, 5);
  });
});
