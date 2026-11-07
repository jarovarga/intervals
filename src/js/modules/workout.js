import { t } from './i18n.js';
import { MAX_SECONDS } from './time.js';

/** How hard a workout is: low, moderate or high intensity; the second one is the default. */
export const INTENSITIES = ['low', 'moderate', 'high'];

export const MAX_ROUNDS = 99;

/** Longest workout or exercise name, in characters. */
export const MAX_NAME_LENGTH = 50;

const DEFAULT_INTENSITY = 'moderate';
const DEFAULT_EXERCISE_SECONDS = 30;
const DEFAULT_PREPARE_SECONDS = 10;
const DEFAULT_REST_SECONDS = 30;
const DEFAULT_ROUND_REST_SECONDS = 60;
const ID_PATTERN = /^[\w-]{1,64}$/;

/**
 * @typedef {{ id: string, name: string, time: number }} Exercise
 * @typedef {{
 *   id: string, name: string, intensity: string, prepare: number, rest: number, rounds: number, roundRest: number,
 *   exercises: Exercise[]
 * }} Workout
 * @typedef {{ type: 'prepare' | 'work' | 'rest' | 'round', duration: number, exercise: number, round: number }} Step
 */

/** @returns {string} A new unique identifier. */
const createId = () => crypto.randomUUID();

/**
 * @param {string} [name] Exercise name.
 * @param {number} [time] Exercise time in seconds.
 * @returns {Exercise} A new exercise.
 */
export const createExercise = (name = t('workout.newExercise'), time = DEFAULT_EXERCISE_SECONDS) => ({
  id: createId(),
  name,
  time
});

/**
 * @param {string} name Workout name.
 * @param {Exercise[]} exercises Its exercises.
 * @returns {Workout} A workout with the default timing, intensity and a single round.
 */
export const createWorkout = (name, exercises) => ({
  id: createId(),
  name,
  intensity: DEFAULT_INTENSITY,
  prepare: DEFAULT_PREPARE_SECONDS,
  rest: DEFAULT_REST_SECONDS,
  rounds: 1,
  roundRest: DEFAULT_ROUND_REST_SECONDS,
  exercises
});

/** @returns {Workout} A workout with one exercise to start editing from. */
export const createBlankWorkout = () =>
  createWorkout(t('workout.new'), [createExercise(t('workout.exerciseNumbered', { n: 1 }))]);

const isId = (value) => typeof value === 'string' && ID_PATTERN.test(value);

const readSeconds = (value, min, fallback) =>
  Number.isInteger(value) && value >= min && value <= MAX_SECONDS ? value : fallback;

const readName = (value, fallback) => {
  const name = typeof value === 'string' ? value.trim().slice(0, MAX_NAME_LENGTH) : '';

  return name || fallback;
};

/**
 * Validate an exercise read from storage or an import.
 *
 * @param {*} raw Stored value of any shape, which is checked here.
 * @returns {Exercise | null} The exercise, or null when it is unusable.
 */
const readExercise = (raw) => {
  if (!raw || typeof raw !== 'object' || !isId(raw.id)) return null;

  return {
    id: raw.id,
    name: readName(raw.name, t('workout.exercise')),
    time: readSeconds(raw.time, 1, DEFAULT_EXERCISE_SECONDS)
  };
};

/**
 * Validate a workout read from storage or an import, repairing out-of-range values.
 *
 * @param {*} raw Stored value of any shape, which is checked here.
 * @returns {Workout | null} The workout, or null when it is unusable.
 */
export const readWorkout = (raw) => {
  if (!raw || typeof raw !== 'object' || !isId(raw.id)) return null;

  const rounds = Number.isInteger(raw.rounds) && raw.rounds >= 1 && raw.rounds <= MAX_ROUNDS ? raw.rounds : 1;

  return {
    id: raw.id,
    name: readName(raw.name, t('workout.workout')),
    intensity: INTENSITIES.includes(raw.intensity) ? raw.intensity : DEFAULT_INTENSITY,
    prepare: readSeconds(raw.prepare, 0, DEFAULT_PREPARE_SECONDS),
    rest: readSeconds(raw.rest, 0, DEFAULT_REST_SECONDS),
    rounds,
    roundRest: readSeconds(raw.roundRest, 0, DEFAULT_ROUND_REST_SECONDS),
    exercises: Array.isArray(raw.exercises) ? raw.exercises.map(readExercise).filter(Boolean) : []
  };
};

/**
 * List the timed steps of a workout. Steps with no time are left out.
 *
 * Rest steps point at the exercise that follows them, so `exercise` is always the number of exercises already done
 * in the round for a rest step and the current exercise for a work step.
 *
 * @param {Workout} workout Workout to run.
 * @returns {Step[]} Steps in running order.
 */
export const buildSteps = (workout) => {
  const { exercises, rounds } = workout;
  /** @type {Step[]} */
  const steps = [{ type: 'prepare', duration: workout.prepare, exercise: 0, round: 0 }];

  for (let round = 0; round < rounds; round += 1) {
    exercises.forEach((exercise, index) => {
      steps.push({ type: 'work', duration: exercise.time, exercise: index, round });

      if (index < exercises.length - 1) {
        steps.push({ type: 'rest', duration: workout.rest, exercise: index + 1, round });
      }
    });

    if (round < rounds - 1) {
      steps.push({ type: 'round', duration: workout.roundRest, exercise: 0, round: round + 1 });
    }
  }

  return steps.filter((step) => step.duration > 0);
};

/**
 * @param {Workout} workout Workout to measure.
 * @returns {number} Whole seconds from the get-ready countdown to the end of the last exercise.
 */
export const totalSeconds = (workout) => buildSteps(workout).reduce((sum, step) => sum + step.duration, 0);
