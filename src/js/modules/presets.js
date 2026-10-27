import { createDefaultWorkout, createWorkout } from './workout.js';

const TABATA_EXERCISE_SECONDS = 20;
const TABATA_REST_SECONDS = 10;
const SEVEN_MINUTE_REST_SECONDS = 10;
const SEVEN_MINUTE_EXERCISES = [
  'Jumping jacks',
  'Wall sit (isometric squat hold)',
  'Push-up',
  'Abdominal crunch',
  'Step-up onto a chair',
  'Bodyweight squat (air squat)',
  'Triceps dip on a chair',
  'Forearm plank hold',
  'High knees running in place',
  'Alternating forward lunge',
  'Push-up with rotation',
  'Side forearm plank hold'
];
const TABATA_EXERCISES = [
  'Jumping jacks',
  'Bodyweight squat (air squat)',
  'Push-up',
  'Mountain climber',
  'Alternating reverse lunge',
  'Burpee',
  'High knees',
  'Forearm plank hold'
];

/** @returns {import('./workout.js').Workout} Eight different 20 s exercises with 10 s of rest between them. */
const createTabata = () => {
  const tabata = createWorkout(TABATA_EXERCISES, 'Tabata');

  return {
    ...tabata,
    id: 'preset-tabata',
    colour: 'green',
    rest: TABATA_REST_SECONDS,
    exercises: tabata.exercises.map((exercise) => ({ ...exercise, time: TABATA_EXERCISE_SECONDS }))
  };
};

/** @returns {import('./workout.js').Workout} Twelve 30 s exercises with 10 s of rest between them. */
const createSevenMinute = () => ({
  ...createWorkout(SEVEN_MINUTE_EXERCISES, '7-minute workout'),
  id: 'preset-7-minute',
  colour: 'green',
  rest: SEVEN_MINUTE_REST_SECONDS
});

/**
 * Ready-made workouts. They are fixed and not stored in the library, so editing one starts a new workout from a copy.
 *
 * @type {import('./workout.js').Workout[]}
 */
const PRESETS = [{ ...createDefaultWorkout(), id: 'preset-30-30' }, createTabata(), createSevenMinute()];

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
