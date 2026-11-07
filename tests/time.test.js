import assert from 'node:assert/strict';
import { test } from 'node:test';

import { format, formatField, MAX_SECONDS, parse } from '../src/js/modules/time.js';

test('parse reads plain numbers as seconds and the colon form as minutes and seconds', () => {
  assert.equal(parse('30'), 30);
  assert.equal(parse(':30'), 30);
  assert.equal(parse('0:30'), 30);
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

test('format writes minutes and seconds, and hours from an hour on', () => {
  assert.equal(format(0), '0:00');
  assert.equal(format(7), '0:07');
  assert.equal(format(45), '0:45');
  assert.equal(format(60), '1:00');
  assert.equal(format(1122), '18:42');
  assert.equal(format(3599), '59:59');
  assert.equal(format(3600), '1:00:00');
  assert.equal(format(17530), '4:52:10');
});

test('a field shows minutes and seconds even past an hour, and reads back as the same seconds', () => {
  assert.equal(formatField(45), '0:45');
  assert.equal(formatField(3600), '60:00');
  assert.equal(formatField(MAX_SECONDS), '99:59');

  for (const seconds of [1, 30, 45, 60, 90, 3600, MAX_SECONDS]) {
    assert.equal(parse(formatField(seconds)), seconds);
  }
});
