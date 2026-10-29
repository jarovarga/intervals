import { createDefaultWorkout, createWorkout } from './workout.js';

const SEVEN_MINUTE_REST_SECONDS = 10;
const SEVEN_MINUTE_EXERCISES = [
  'Jumping jacks',
  'Wall sit (isometric squat hold)',
  'Push-up',
  'Abdominal crunch',
  'Step-up onto chair',
  'Bodyweight squat (air squat)',
  'Triceps dip on chair',
  'Forearm plank hold',
  'High knees (running in place)',
  'Lunge',
  'Push-up and rotation',
  'Side forearm plank hold (left)',
  'Side forearm plank hold (right)'
];

/** @returns {import('./workout.js').Workout} Thirteen 30 s exercises with 10 s of rest between them. */
const createSevenMinute = () => ({
  ...createWorkout(SEVEN_MINUTE_EXERCISES, '7-minute workout'),
  id: 'preset-7-minute',
  rest: SEVEN_MINUTE_REST_SECONDS
});

/**
 * Ready-made workouts. They are fixed and not stored in the library, so editing one starts a new workout from a copy.
 *
 * @type {import('./workout.js').Workout[]}
 */
const PRESETS = [{ ...createDefaultWorkout(), id: 'preset-30-30' }, createSevenMinute()];

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
