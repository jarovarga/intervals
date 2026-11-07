import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isAvailable, isEligible, isIos } from '../src/js/modules/install.js';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

const environment = (changes) => ({
  userAgent: IPHONE,
  maxTouchPoints: 5,
  standalone: false,
  promptable: false,
  dismissed: false,
  ...changes
});

test('the install banner shows on iPhone in the browser', () => {
  assert.equal(isEligible(environment()), true);
});

test('the install banner shows on iPad, which reports itself as a Mac with a touch screen', () => {
  assert.equal(isEligible(environment({ userAgent: MAC, maxTouchPoints: 5 })), true);
});

test('the install banner stays hidden on a Mac without touch, on Android and once installed or dismissed', () => {
  assert.equal(isEligible(environment({ userAgent: MAC, maxTouchPoints: 0 })), false);
  assert.equal(isEligible(environment({ userAgent: ANDROID })), false);
  assert.equal(isEligible(environment({ standalone: true })), false);
  assert.equal(isEligible(environment({ dismissed: true })), false);
});

test('the install banner shows in a browser that has offered its own install prompt', () => {
  assert.equal(isEligible(environment({ userAgent: ANDROID, promptable: true })), true);
  assert.equal(isEligible(environment({ userAgent: ANDROID, promptable: true, standalone: true })), false);
});

test('the install guide stays available after the banner was dismissed', () => {
  assert.equal(isAvailable(environment({ dismissed: true })), true);
  assert.equal(isAvailable(environment({ userAgent: ANDROID })), false);
});

test('the steps for iOS apply to iPhone and iPad only', () => {
  assert.equal(isIos(environment()), true);
  assert.equal(isIos(environment({ userAgent: MAC, maxTouchPoints: 5 })), true);
  assert.equal(isIos(environment({ userAgent: MAC, maxTouchPoints: 0 })), false);
  assert.equal(isIos(environment({ userAgent: ANDROID })), false);
});
