import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { en } from '../src/js/locales/en.js';
import { sk } from '../src/js/locales/sk.js';
import { count, getLocale, list, resolve, setLanguage, t } from '../src/js/modules/i18n.js';

const NO_BREAK_SPACE = ' ';
const PLACEHOLDER = /\{\w+\}/g;

afterEach(() => setLanguage('en'));

test('the chosen language applies, and English when none or an unknown one was chosen', () => {
  assert.equal(resolve('sk'), 'sk');
  assert.equal(resolve('en'), 'en');
  assert.equal(resolve(undefined), 'en');
  assert.equal(resolve('de'), 'en');
});

test('English uses the British locale, which starts the week on Monday', () => {
  assert.equal(getLocale(), 'en-GB');

  setLanguage('sk');

  assert.equal(getLocale(), 'sk');
});

test('an unknown language is ignored', () => {
  setLanguage('de');

  assert.equal(getLocale(), 'en-GB');
});

test('Slovak counts have a form for one, for two to four and for the rest', () => {
  setLanguage('sk');

  assert.equal(count('count.exercises', 1), `1${NO_BREAK_SPACE}cvik`);
  assert.equal(count('count.exercises', 2), `2${NO_BREAK_SPACE}cviky`);
  assert.equal(count('count.exercises', 4), `4${NO_BREAK_SPACE}cviky`);
  assert.equal(count('count.exercises', 5), `5${NO_BREAK_SPACE}cvikov`);
  assert.equal(count('count.exercises', 0), `0${NO_BREAK_SPACE}cvikov`);
});

test('English counts have a form for one and for the rest', () => {
  assert.equal(count('count.rounds', 1), `1${NO_BREAK_SPACE}round`);
  assert.equal(count('count.rounds', 2), `2${NO_BREAK_SPACE}rounds`);
});

test('a text takes its parameters, and a missing key is shown as the key', () => {
  assert.equal(t('timer.round', { n: 2, total: 5 }), 'Round 2 of 5');
  assert.equal(t('no.such.key'), 'no.such.key');

  setLanguage('sk');

  assert.equal(t('timer.round', { n: 2, total: 5 }), 'Kolo 2 z 5');
});

test('a list is joined the way the language does', () => {
  assert.equal(list(['a', 'b', 'c']), 'a, b and c');

  setLanguage('sk');

  assert.equal(list(['a', 'b', 'c']), 'a, b a c');
});

test('Slovak has every text of English, with the same parameters and plural forms', () => {
  assert.deepEqual(Object.keys(sk).toSorted(), Object.keys(en).toSorted());

  Object.entries(en).forEach(([key, text]) => {
    const other = sk[key];

    if (typeof text === 'string') {
      assert.equal(typeof other, 'string', key);
      assert.deepEqual(other.match(PLACEHOLDER)?.toSorted(), text.match(PLACEHOLDER)?.toSorted(), key);
    } else {
      assert.ok(other.one && other.few && other.other, key);
    }
  });
});
