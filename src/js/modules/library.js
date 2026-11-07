import { MS } from './time.js';
import { createStore } from './store.js';
import { readWorkout, totalSeconds } from './workout.js';

/** How long after it was saved the progress of a workout can still be picked up again: one hour. */
const SESSION_MAX_AGE = 60 * 60 * MS;

/**
 * @typedef {import('./workout.js').Workout} Workout
 * @typedef {{ id: string, name: string, at: number, seconds: number }} Completion
 * @typedef {{ id: string, elapsed: number, savedAt: number }} Session
 */

/**
 * @param {unknown} raw One stored completion.
 * @returns {Completion | null} The completion, or null when it is not valid.
 */
const readCompletion = (raw) => {
  const { id, name, at, seconds } = /** @type {Record<string, unknown>} */ (raw ?? {});
  const valid = typeof id === 'string' && typeof name === 'string' && Number.isFinite(at);

  return valid && Number.isInteger(seconds) && Number(seconds) > 0
    ? { id, name, at: Number(at), seconds: Number(seconds) }
    : null;
};

/**
 * @param {unknown} raw Stored progress of a workout.
 * @returns {Session | null} The progress, or null when it is not valid.
 */
const readSession = (raw) => {
  const { id, elapsed, savedAt } = /** @type {Record<string, unknown>} */ (raw ?? {});

  return typeof id === 'string' && Number(elapsed) >= 0 && Number.isFinite(savedAt)
    ? { id, elapsed: Number(elapsed), savedAt: Number(savedAt) }
    : null;
};

const list = (read) => (data) => (Array.isArray(data) ? data.map(read).filter(Boolean) : []);

const workouts = createStore('intervals:workouts', { version: 1, read: list(readWorkout), empty: () => [] });

// The finished workouts live apart from the workouts, so that deleting the workouts keeps the history.
const log = createStore('intervals:log', { version: 1, read: list(readCompletion), empty: () => [] });

const session = createStore('intervals:session', { version: 1, read: readSession, empty: () => null });

let persistenceRequested = false;

/**
 * Ask the browser once, after the first workout was saved, not to evict the stored data under storage pressure.
 * Browsers may refuse, and the answer changes nothing for the app, so it neither blocks nor reports.
 *
 * @returns {void}
 */
const requestPersistence = () => {
  if (persistenceRequested) return;

  persistenceRequested = true;
  Promise.resolve(navigator.storage?.persist?.()).catch((error) => {
    console.warn('Persistent storage could not be requested.', error);
  });
};

/**
 * Give a new device its first workouts. A device that has stored workouts before, even none after a deletion, keeps
 * what it has.
 *
 * @param {Workout[]} starters Workouts to begin with.
 * @returns {void}
 */
export const seed = (starters) => {
  if (!workouts.has()) workouts.set(starters);
};

/** @returns {Workout[]} All workouts in display order. */
export const getWorkouts = () => workouts.get();

/**
 * @param {string} id Workout identifier.
 * @returns {Workout | undefined} The workout, if it exists.
 */
export const getWorkout = (id) => workouts.get().find((workout) => workout.id === id);

/**
 * Add a workout at the end, or replace the one with the same identifier in its place.
 *
 * @param {Workout} workout Workout to store.
 * @returns {boolean} Whether it reached storage; when it did not, it lasts until the app closes.
 */
export const saveWorkout = (workout) => {
  const current = workouts.get();
  const exists = current.some(({ id }) => id === workout.id);
  const saved = workouts.set(
    exists ? current.map((item) => (item.id === workout.id ? workout : item)) : [...current, workout]
  );

  requestPersistence();

  return saved;
};

/**
 * @param {string} id Identifier of the workout to remove.
 * @returns {boolean} Whether the removal reached storage.
 */
export const deleteWorkout = (id) => workouts.set(workouts.get().filter((workout) => workout.id !== id));

/**
 * Save how far a workout has got, so that it can be picked up again after a reload, or after iOS has ended the app in
 * the background.
 *
 * @param {Session} progress Workout, its active milliseconds and the `Date.now()` of saving.
 * @returns {boolean} Whether it reached storage; a full store only costs the resume.
 */
export const saveSession = (progress) => session.set(progress);

/**
 * @param {number} [now] `Date.now()`, to tell whether the progress is too old to be worth picking up.
 * @returns {Session | null} The saved progress, or null when there is none, or it is older than an hour.
 */
export const loadSession = (now = Date.now()) => {
  const progress = session.get();

  return progress && now - progress.savedAt <= SESSION_MAX_AGE ? progress : null;
};

/** @returns {boolean} Whether the progress was forgotten in storage too. */
export const clearSession = () => session.set(null);

/**
 * Delete every workout and the progress of an unfinished one. The finished workouts stay in the log.
 *
 * @returns {boolean} Whether the deletion reached storage.
 */
export const clearWorkouts = () => {
  const progressCleared = clearSession();

  return workouts.set([]) && progressCleared;
};

/**
 * Delete the workouts, the log of finished workouts and the progress of an unfinished one.
 *
 * @returns {boolean} Whether the deletion reached storage.
 */
export const clearAll = () => {
  const workoutsCleared = clearWorkouts();

  return log.set([]) && workoutsCleared;
};

/** @returns {Completion[]} Every finished workout, oldest first. */
export const getCompletions = () => log.get();

/**
 * Note that a workout was finished. Its name and length are kept as they were, so that the log survives a later edit
 * or deletion of the workout.
 *
 * @param {Workout} workout The workout that was finished.
 * @param {number} [at] `Date.now()` of the finish.
 * @returns {boolean} Whether it reached storage; a full store only costs the log.
 */
export const recordCompletion = (workout, at = Date.now()) =>
  log.set([...log.get(), { id: workout.id, name: workout.name, at, seconds: totalSeconds(workout) }]);

/** @returns {{ workouts: Workout[], completions: Completion[] }} The workouts and the log, as an export carries them. */
export const exportData = () => ({ workouts: workouts.get(), completions: log.get() });

/**
 * Add the workouts and finished workouts of an export. A workout whose identifier is already saved is added as a copy
 * with a new identifier, so an import never replaces a workout; a finished workout that the log already holds is
 * skipped.
 *
 * @param {{ workouts?: unknown, completions?: unknown }} data The workouts and completions of an export.
 * @returns {{ workouts: number, completions: number, saved: boolean }} How many were added and whether they reached storage.
 */
export const importData = ({ workouts: rawWorkouts, completions: rawCompletions }) => {
  const known = new Set(workouts.get().map(({ id }) => id));
  const added = list(readWorkout)(rawWorkouts).map((workout) =>
    known.has(workout.id) ? { ...workout, id: crypto.randomUUID() } : workout
  );
  const logged = new Set(log.get().map(({ id, at }) => `${id}:${at}`));
  const finished = list(readCompletion)(rawCompletions).filter(({ id, at }) => {
    const fresh = !logged.has(`${id}:${at}`);

    logged.add(`${id}:${at}`);

    return fresh;
  });
  const workoutsSaved = added.length === 0 || workouts.set([...workouts.get(), ...added]);
  const logSaved = finished.length === 0 || log.set([...log.get(), ...finished].toSorted((a, b) => a.at - b.at));

  if (added.length > 0) requestPersistence();

  return { workouts: added.length, completions: finished.length, saved: workoutsSaved && logSaved };
};

/**
 * Follow changes that another window of the app makes to the workouts, the log or the progress.
 *
 * @param {EventTarget} [target] Where `storage` events arrive: the window.
 * @returns {void}
 */
export const init = (target = window) => {
  workouts.watch(target);
  log.watch(target);
  session.watch(target);
};
