import { MS } from './time.js';
import { COUNTDOWN_SECONDS, MAX_COUNTDOWN } from './timeline.js';
import { readWorkout } from './workout.js';

const STORAGE_KEY = 'intervals:v1';
const VERSION = 1;
const BACKUP_KEY = `${STORAGE_KEY}:backup`;
const SESSION_KEY = `${STORAGE_KEY}:session`;

/** How long after it was saved the progress of a workout can still be picked up again: one hour. */
const SESSION_MAX_AGE = 60 * 60 * MS;

/**
 * @typedef {{ sound: boolean, volume: number, countdown: number, keepAwake: boolean }} Settings
 * @typedef {Settings & { workouts: import('./workout.js').Workout[] }} Library
 */

/** @type {Library | null} */
let library = null;

/** Set when unreadable stored data could not be backed up, so that it is never overwritten. */
let persistLocked = false;

let persistenceRequested = false;

/**
 * Ask the browser once not to evict the stored workouts under storage pressure. Browsers may refuse, and
 * the answer changes nothing for the app, so it neither blocks nor reports.
 *
 * @returns {void}
 */
const requestPersistence = () => {
  if (persistenceRequested) {
    return;
  }

  persistenceRequested = true;

  Promise.resolve(navigator.storage?.persist?.()).catch((error) => {
    console.warn('Persistent storage could not be requested.', error);
  });
};

/**
 * Write the library to localStorage. A full or blocked store only costs persistence, so the app keeps working.
 *
 * @returns {void}
 */
const persist = () => {
  if (persistLocked) {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...library }));
  } catch (error) {
    console.warn('The workouts could not be saved.', error);
  }
};

/** @type {Settings} */
const DEFAULT_SETTINGS = { sound: true, volume: 1, countdown: COUNTDOWN_SECONDS, keepAwake: true };

/**
 * @param {Record<string, unknown>} stored Stored library, which may come from an earlier version without every setting.
 * @param {Settings} [fallback] Settings to take where one is missing or out of range.
 * @returns {Settings} The settings.
 */
const readSettings = (stored, fallback = DEFAULT_SETTINGS) => {
  const { volume, countdown } = stored;

  return {
    sound: typeof stored.sound === 'boolean' ? stored.sound : fallback.sound,
    volume: typeof volume === 'number' && volume >= 0 && volume <= 1 ? volume : fallback.volume,
    countdown:
      Number.isInteger(countdown) && countdown >= 0 && countdown <= MAX_COUNTDOWN ? countdown : fallback.countdown,
    keepAwake: typeof stored.keepAwake === 'boolean' ? stored.keepAwake : fallback.keepAwake
  };
};

/**
 * Read and validate the stored library, falling back to an empty library when nothing usable is stored.
 *
 * @returns {Library} Library to work with.
 */
const read = () => {
  let raw = null;

  try {
    raw = localStorage.getItem(STORAGE_KEY);

    const stored = raw === null ? null : JSON.parse(raw);

    if (stored && stored.version === VERSION && Array.isArray(stored.workouts)) {
      return {
        ...readSettings(stored),
        workouts: stored.workouts.map(readWorkout).filter(Boolean)
      };
    }
  } catch (error) {
    console.warn('The stored workouts could not be read.', error);
  }

  // Keep what could not be read, so that starting over does not destroy a recoverable value.
  if (raw !== null) {
    try {
      localStorage.setItem(BACKUP_KEY, raw);
    } catch (error) {
      // Without a backup, any write would destroy the only copy, so this session stays in memory.
      persistLocked = true;
      console.warn('The unreadable workouts could not be backed up.', error);
    }
  }

  const fresh = { ...readSettings({}), workouts: [] };

  library = fresh;
  persist();

  return fresh;
};

/**
 * @returns {Library} The loaded library.
 */
const current = () => {
  library ??= read();

  return library;
};

/** @returns {import('./workout.js').Workout[]} All workouts in display order. */
export const getWorkouts = () => current().workouts;

/**
 * @param {string} id Workout identifier.
 * @returns {import('./workout.js').Workout | undefined} The workout, if it exists.
 */
export const getWorkout = (id) => current().workouts.find((workout) => workout.id === id);

/**
 * Add a workout, or replace the one with the same identifier.
 *
 * @param {import('./workout.js').Workout} workout Workout to store.
 * @returns {void}
 */
export const saveWorkout = (workout) => {
  const { workouts } = current();
  const index = workouts.findIndex((item) => item.id === workout.id);

  if (index === -1) {
    workouts.push(workout);
  } else {
    workouts[index] = workout;
  }

  persist();
  requestPersistence();
};

/**
 * @param {string} id Identifier of the workout to remove.
 * @returns {void}
 */
export const deleteWorkout = (id) => {
  const state = current();

  state.workouts = state.workouts.filter((workout) => workout.id !== id);
  persist();
};

/** @returns {boolean} Whether the signals are on. */
export const isSoundOn = () => current().sound;

/**
 * @param {boolean} on Whether the signals are on.
 * @returns {void}
 */
export const setSoundOn = (on) => {
  current().sound = on;
  persist();
};

/** @returns {Settings} A copy of the settings. */
export const getSettings = () => {
  const { sound, volume, countdown, keepAwake } = current();

  return { sound, volume, countdown, keepAwake };
};

/**
 * @param {Partial<Settings>} changes Settings to change; a value out of range is ignored.
 * @returns {void}
 */
export const updateSettings = (changes) => {
  const settings = getSettings();

  Object.assign(current(), readSettings({ ...settings, ...changes }, settings));
  persist();
};

/**
 * @param {import('./workout.js').Workout[]} [workouts] Workouts to export; all saved workouts by default.
 * @returns {{ version: number, workouts: import('./workout.js').Workout[] }} The workouts, in the form that `importWorkouts` takes back.
 */
export const exportWorkouts = (workouts = current().workouts) => ({ version: VERSION, workouts });

/**
 * Add the workouts of an export to the library. A workout whose identifier is already saved is added as a copy with a
 * new identifier, so an import never replaces a workout.
 *
 * @param {string} text Contents of an export file.
 * @returns {number | null} How many workouts were added, or null when the text is not an export.
 */
export const importWorkouts = (text) => {
  let stored;

  try {
    stored = JSON.parse(text);
  } catch {
    return null;
  }

  if (stored?.version !== VERSION || !Array.isArray(stored.workouts)) {
    return null;
  }

  const workouts = stored.workouts.map(readWorkout).filter(Boolean);

  workouts.forEach((workout) =>
    saveWorkout(getWorkout(workout.id) ? { ...workout, id: crypto.randomUUID() } : workout)
  );

  return workouts.length;
};

/**
 * Delete every saved workout and the progress of an unfinished one. The settings stay.
 *
 * @returns {void}
 */
export const clearWorkouts = () => {
  current().workouts = [];
  persist();
  clearSession();
};

/**
 * Remember how far a workout has got, so that it can be picked up again after a reload, or after iOS has ended the app
 * in the background. A full or blocked store only costs the resume, so the app keeps working.
 *
 * @param {{ id: string, elapsed: number, savedAt: number }} session Workout, its active milliseconds and Date.now().
 * @returns {void}
 */
export const saveSession = (session) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn('The workout progress could not be saved.', error);
  }
};

/**
 * @param {number} [now] Date.now(), to tell whether the progress is too old to be worth picking up.
 * @returns {{ id: string, elapsed: number, savedAt: number } | null} The saved progress, or null when there is none.
 */
export const loadSession = (now = Date.now()) => {
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    const valid = typeof stored?.id === 'string' && stored.elapsed >= 0 && Number.isFinite(stored.savedAt);

    if (valid && now - stored.savedAt <= SESSION_MAX_AGE) {
      return { id: stored.id, elapsed: stored.elapsed, savedAt: stored.savedAt };
    }
  } catch (error) {
    console.warn('The saved workout progress could not be read.', error);
  }

  return null;
};

/**
 * @returns {void}
 */
export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.warn('The saved workout progress could not be cleared.', error);
  }
};
