import { isLanguage } from './i18n.js';

const STORAGE_KEY = 'intervals:preferences';
const BACKUP_KEY = `${STORAGE_KEY}:backup`;
const VERSION = 1;

/** Most seconds of ticking before the end of a step. */
export const MAX_COUNTDOWN = 5;

/** Largest weekly goal: a workout on every day of the week. */
export const MAX_WEEKLY_GOAL = 7;

/**
 * @typedef {{
 *   sound: boolean, volume: number, playback: boolean, countdown: number, keepAwake: boolean, weeklyGoal: number,
 *   language: string | null
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
  const { sound, volume, playback, countdown, keepAwake, weeklyGoal, language } = stored;

  return {
    sound: typeof sound === 'boolean' ? sound : fallback.sound,
    volume: typeof volume === 'number' && volume >= 0 && volume <= 1 ? volume : fallback.volume,
    playback: typeof playback === 'boolean' ? playback : fallback.playback,
    countdown: isCount(countdown, MAX_COUNTDOWN) ? Number(countdown) : fallback.countdown,
    keepAwake: typeof keepAwake === 'boolean' ? keepAwake : fallback.keepAwake,
    weeklyGoal: isCount(weeklyGoal, MAX_WEEKLY_GOAL) ? Number(weeklyGoal) : fallback.weeklyGoal,
    language: language === null || isLanguage(language) ? /** @type {string | null} */ (language) : fallback.language
  };
};

/** @type {Preferences | null} */
let preferences = null;

/** Set when unreadable stored preferences could not be backed up, so that they are never overwritten. */
let locked = false;

/**
 * Read the stored preferences. What has an unknown version or cannot be read is backed up before the defaults apply,
 * and when even the backup fails, nothing is written for the rest of the session.
 *
 * @returns {Preferences} The preferences.
 */
const read = () => {
  let raw = null;

  try {
    raw = localStorage.getItem(STORAGE_KEY);

    const stored = raw === null ? null : JSON.parse(raw);

    if (raw === null) return { ...DEFAULTS };
    if (stored?.version === VERSION) return readPreferences(stored);
  } catch (error) {
    console.warn('The stored preferences could not be read.', error);
  }

  if (raw !== null) {
    try {
      localStorage.setItem(BACKUP_KEY, raw);
    } catch (error) {
      locked = true;
      console.warn('The unreadable preferences could not be backed up.', error);
    }
  }

  return { ...DEFAULTS };
};

/** @returns {Preferences} The preferences in use, read from storage on first use. */
const current = () => {
  preferences ??= read();

  return preferences;
};

/** @returns {Preferences} A copy of the preferences. */
export const get = () => ({ ...current() });

/**
 * Change preferences and store them. A value out of range is ignored.
 *
 * @param {Partial<Preferences>} changes Preferences to change.
 * @returns {boolean} Whether the change reached storage; when it did not, it lasts until the app closes.
 */
export const update = (changes) => {
  preferences = readPreferences({ ...current(), ...changes }, current());

  if (locked) return false;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...preferences }));
    return true;
  } catch (error) {
    console.warn('The preferences could not be saved.', error);
    return false;
  }
};

/**
 * Read the preferences again when another window of the app, such as the installed app next to a browser tab, changes
 * them, so that the next change here does not overwrite that one.
 *
 * @param {EventTarget} [target] Where `storage` events arrive: the window.
 * @returns {void}
 */
export const init = (target = window) => {
  target.addEventListener('storage', (/** @type {StorageEvent} */ event) => {
    // The key is null when the whole store was cleared.
    if (event.key === null || event.key === STORAGE_KEY) preferences = null;
  });
};
