import { isLanguage } from './i18n.js';
import { createStore } from './store.js';

/** Most seconds of ticking before the end of a step. */
export const MAX_COUNTDOWN = 5;

/** Largest weekly goal: a workout on every day of the week. */
export const MAX_WEEKLY_GOAL = 7;

/**
 * @typedef {{
 *   sound: boolean, volume: number, playback: boolean, countdown: number, keepAwake: boolean, weeklyGoal: number,
 *   streakHint: boolean, language: string | null
 * }} Preferences
 */

/** @type {Readonly<Preferences>} */
export const DEFAULTS = Object.freeze({
  sound: true,
  volume: 1,
  // Playing in silent mode interrupts music from other apps, so it waits until the user asks for it.
  playback: false,
  countdown: 3,
  keepAwake: true,
  // No goal until the user sets one.
  weeklyGoal: 0,
  // The home screen suggests a weekly goal until one is set or the suggestion is dismissed.
  streakHint: true,
  // Not chosen yet: the app speaks English.
  language: null
});

/**
 * @param {unknown} value Any value.
 * @param {number} max Largest allowed whole number.
 * @returns {boolean} Whether the value is a whole number from 0 to `max`.
 */
const isCount = (value, max) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max;

/**
 * Take the valid preferences from stored data, which may come from an export or an earlier version.
 *
 * @param {Record<string, unknown>} stored Stored preferences.
 * @param {Preferences} [fallback] Preferences to take where one is missing or out of range.
 * @returns {Preferences} The preferences.
 */
export const readPreferences = (stored, fallback = DEFAULTS) => {
  const { sound, volume, playback, countdown, keepAwake, weeklyGoal, streakHint, language } = stored;

  return {
    sound: typeof sound === 'boolean' ? sound : fallback.sound,
    volume: typeof volume === 'number' && volume >= 0 && volume <= 1 ? volume : fallback.volume,
    playback: typeof playback === 'boolean' ? playback : fallback.playback,
    countdown: isCount(countdown, MAX_COUNTDOWN) ? Number(countdown) : fallback.countdown,
    keepAwake: typeof keepAwake === 'boolean' ? keepAwake : fallback.keepAwake,
    weeklyGoal: isCount(weeklyGoal, MAX_WEEKLY_GOAL) ? Number(weeklyGoal) : fallback.weeklyGoal,
    streakHint: typeof streakHint === 'boolean' ? streakHint : fallback.streakHint,
    language: language === null || isLanguage(language) ? /** @type {string | null} */ (language) : fallback.language
  };
};

const store = createStore('intervals:preferences', {
  version: 1,
  read: (data) =>
    readPreferences(data !== null && typeof data === 'object' ? /** @type {Record<string, unknown>} */ (data) : {}),
  empty: () => ({ ...DEFAULTS })
});

/** @returns {Preferences} A copy of the preferences. */
export const get = () => ({ ...store.get() });

/**
 * Change preferences and store them. A value out of range is ignored.
 *
 * @param {Partial<Preferences>} changes Preferences to change.
 * @returns {boolean} Whether the change reached storage; when it did not, it lasts until the app closes.
 */
export const update = (changes) => store.set(readPreferences({ ...store.get(), ...changes }, store.get()));

/**
 * Return every preference to its default.
 *
 * @returns {boolean} Whether the reset reached storage.
 */
export const reset = () => store.set({ ...DEFAULTS });

/**
 * Follow changes that another window of the app makes to the preferences.
 *
 * @param {EventTarget} [target] Where `storage` events arrive: the window.
 * @returns {void}
 */
export const init = (target = window) => store.watch(target);
