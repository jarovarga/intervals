import { readWorkout } from './workout.js';

const STORAGE_KEY = 'intervals:v1';
const VERSION = 1;
const BACKUP_KEY = `${STORAGE_KEY}:backup`;

/** @type {{ sound: boolean, workouts: import('./workout.js').Workout[] } | null} */
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

/**
 * Read and validate the stored library, falling back to an empty library when nothing usable is stored.
 *
 * @returns {{ sound: boolean, workouts: import('./workout.js').Workout[] }} Library to work with.
 */
const read = () => {
  let raw = null;

  try {
    raw = localStorage.getItem(STORAGE_KEY);

    const stored = raw === null ? null : JSON.parse(raw);

    if (stored && stored.version === VERSION && Array.isArray(stored.workouts)) {
      return {
        sound: stored.sound !== false,
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

  const fresh = { sound: true, workouts: [] };

  library = fresh;
  persist();

  return fresh;
};

/**
 * @returns {{ sound: boolean, workouts: import('./workout.js').Workout[] }} The loaded library.
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
