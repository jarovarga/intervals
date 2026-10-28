import { MAX_SECONDS } from './time.js';

/** Colours a workout can use; the first one is the default. */
export const COLOURS = ['green', 'orange', 'blue', 'yellow', 'pink', 'purple'];

/** Most rounds a workout can have. */
export const MAX_ROUNDS = 99;

/** Longest workout name, in characters. */
export const MAX_NAME_LENGTH = 50;

const DEFAULT_EXERCISE_SECONDS = 30;
const DEFAULT_PREPARE_SECONDS = 10;
const DEFAULT_REST_SECONDS = 30;
const DEFAULT_ROUND_REST_SECONDS = 60;
const DEFAULT_EXERCISES = [
  'Slow mountain climber',
  'Bodyweight squat (air squat)',
  'Push-up',
  'Alternating forward lunge',
  'Reverse crunch (hip lift)',
  'Wall sit (isometric squat hold)',
  'Forearm plank hold',
  'Side forearm plank hold (left)',
  'Side forearm plank hold (right)'
];
const ID_PATTERN = /^[\w-]{1,64}$/;

/**
 * @typedef {{ id: string, name: string, time: number }} Exercise
 * @typedef {{
 *   id: string, name: string, colour: string, prepare: number, rest: number, rounds: number, roundRest: number,
 *   exercises: Exercise[]
 * }} Workout
 */

/**
 * @returns {string} A new unique identifier.
 */
const createId = () => crypto.randomUUID();

/**
 * @param {string} [name] Exercise name.
 * @returns {Exercise} A new exercise with the default time.
 */
export const createExercise = (name = 'New exercise') => ({
  id: createId(),
  name,
  time: DEFAULT_EXERCISE_SECONDS
});

/**
 * @param {string[]} names Exercise names.
 * @param {string} workoutName Workout name.
 * @returns {Workout} A workout with 30 s exercises, 10 s rest and a single round.
 */
export const createWorkout = (names, workoutName) => ({
  id: createId(),
  name: workoutName,
  colour: COLOURS[0],
  prepare: DEFAULT_PREPARE_SECONDS,
  rest: DEFAULT_REST_SECONDS,
  rounds: 1,
  roundRest: DEFAULT_ROUND_REST_SECONDS,
  exercises: names.map((name) => createExercise(name))
});

/** @returns {Workout} The circuit that ships with the app. */
export const createDefaultWorkout = () => createWorkout(DEFAULT_EXERCISES, '30/30 MIIT');

/** @returns {Workout} An empty-ish workout to start editing from. */
export const createBlankWorkout = () => createWorkout(['Exercise 1'], 'New workout');

const isId = (value) => typeof value === 'string' && ID_PATTERN.test(value);

const readSeconds = (value, min, fallback) =>
  Number.isInteger(value) && value >= min && value <= MAX_SECONDS ? value : fallback;

const readName = (value, fallback) => {
  const name = typeof value === 'string' ? value.trim().slice(0, MAX_NAME_LENGTH) : '';

  return name || fallback;
};

/**
 * Validate an exercise read from storage.
 *
 * @param {unknown} raw Stored value.
 * @returns {Exercise | null} The exercise, or null when it is unusable.
 */
const readExercise = (raw) => {
  if (!raw || typeof raw !== 'object' || !isId(raw.id)) return null;

  return {
    id: raw.id,
    name: readName(raw.name, 'Exercise'),
    time: readSeconds(raw.time, 1, DEFAULT_EXERCISE_SECONDS)
  };
};

/**
 * Validate a workout read from storage, repairing out-of-range values.
 *
 * @param {unknown} raw Stored value.
 * @returns {Workout | null} The workout, or null when it is unusable.
 */
export const readWorkout = (raw) => {
  if (!raw || typeof raw !== 'object' || !isId(raw.id)) return null;

  const rounds = Number.isInteger(raw.rounds) && raw.rounds >= 1 && raw.rounds <= MAX_ROUNDS ? raw.rounds : 1;

  return {
    id: raw.id,
    name: readName(raw.name, 'Workout'),
    colour: COLOURS.includes(raw.colour) ? raw.colour : COLOURS[0],
    prepare: readSeconds(raw.prepare, 0, DEFAULT_PREPARE_SECONDS),
    rest: readSeconds(raw.rest, 0, DEFAULT_REST_SECONDS),
    rounds,
    roundRest: readSeconds(raw.roundRest, 0, DEFAULT_ROUND_REST_SECONDS),
    exercises: Array.isArray(raw.exercises) ? raw.exercises.map(readExercise).filter(Boolean) : []
  };
};

/**
 * @typedef {{ type: 'prepare' | 'work' | 'rest' | 'round', duration: number, exercise: number, round: number }} Step
 */

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
 * @returns {number} Whole seconds from the countdown to the last exercise.
 */
export const totalSeconds = (workout) => buildSteps(workout).reduce((sum, step) => sum + step.duration, 0);
