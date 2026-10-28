import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatClock, formatField, formatTotal, MAX_SECONDS, parse } from '../src/js/modules/time.js';

test('parse reads plain numbers as seconds and the colon form as minutes and seconds', () => {
  assert.equal(parse('30'), 30);
  assert.equal(parse(':30'), 30);
  assert.equal(parse('1:30'), 90);
  assert.equal(parse('130'), 130);
  assert.equal(parse('2:10'), 130);
  assert.equal(parse('1000'), 1000);
  assert.equal(parse(' 90 '), 90);
  assert.equal(parse('99:59'), MAX_SECONDS);
});

test('parse rejects text that is not a time', () => {
  for (const text of ['', 'abc', '1:75', ':60', '6000', '100:00', '12345', '-5', '1.5']) {
    assert.equal(parse(text, { allowZero: true }), null, text);
  }
});

test('parse accepts zero only when asked to', () => {
  assert.equal(parse('0'), null);
  assert.equal(parse(':00'), null);
  assert.equal(parse('0', { allowZero: true }), 0);
});

test('format functions agree with the design', () => {
  assert.equal(formatField(30), ':30');
  assert.equal(formatField(60), '1:00');
  assert.equal(formatField(90), '1:30');
  assert.equal(formatField(0), ':00');
  assert.equal(formatClock(10), '00:10');
  assert.equal(formatClock(3599), '59:59');
  assert.equal(formatTotal(320), '5:20');
  assert.equal(formatTotal(30), '0:30');
});
