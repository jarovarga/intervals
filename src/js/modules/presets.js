import { createDefaultWorkout, createWorkout } from './workout.js';

const TABATA_EXERCISE_SECONDS = 20;
const TABATA_REST_SECONDS = 10;
// Moderate effort: no burpees or jump squats. No two neighbouring exercises load the same muscles (legs, push, cardio, core).
const TABATA_EXERCISES = [
  'Bodyweight squat (air squat)',
  'Push-up',
  'Jumping jacks',
  'Bicycle crunch (elbow to opposite knee)',
  'Alternating reverse lunge',
  'Plank shoulder tap (high plank)',
  'High knees (running in place)',
  'Mountain climber'
];

/** @returns {import('./workout.js').Workout} Eight different 20 s exercises with 10 s of rest between them. */
const createTabata = () => {
  const tabata = createWorkout(TABATA_EXERCISES, 'Tabata');

  return {
    ...tabata,
    id: 'preset-tabata',
    rest: TABATA_REST_SECONDS,
    exercises: tabata.exercises.map((exercise) => ({ ...exercise, time: TABATA_EXERCISE_SECONDS }))
  };
};

/**
 * Ready-made workouts. They are fixed and not stored in the library, so editing one starts a new workout from a copy.
 *
 * @type {import('./workout.js').Workout[]}
 */
const PRESETS = [{ ...createDefaultWorkout(), id: 'preset-30-30' }, createTabata()];

/** @returns {import('./workout.js').Workout[]} The presets in display order. */
export const getPresets = () => PRESETS;

/**
 * @param {string} id Preset identifier.
 * @returns {import('./workout.js').Workout | undefined} The preset, if it exists.
 */
export const getPreset = (id) => PRESETS.find((preset) => preset.id === id);

/**
 * @param {string} id Preset identifier.
 * @returns {import('./workout.js').Workout | undefined} An editable copy of the preset with a new identifier.
 */
export const copyPreset = (id) => {
  const preset = getPreset(id);

  return preset && { ...structuredClone(preset), id: crypto.randomUUID() };
};
