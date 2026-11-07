import { t } from './i18n.js';
import { createExercise, createWorkout } from './workout.js';

/** A 30/30 circuit: nine 30 s exercises with 30 s of rest between them. */
const CIRCUIT = {
  id: '30-30',
  name: '30/30 Circuit',
  intensity: 'moderate',
  work: 30,
  rest: 30,
  exercises: [
    'exercise.slowMountainClimber',
    'exercise.airSquat',
    'exercise.pushUp',
    'exercise.forwardLunge',
    'exercise.reverseCrunch',
    'exercise.wallSit',
    'exercise.forearmPlank',
    'exercise.sidePlankLeft',
    'exercise.sidePlankRight'
  ]
};

/**
 * Tabata: eight 20 s intervals with 10 s of rest, four minutes with the get ready. Eight different bodyweight exercises
 * replace the single all-out effort of the original protocol, and no two neighbours load the same muscles.
 */
const TABATA = {
  id: 'tabata',
  name: 'Tabata',
  intensity: 'high',
  work: 20,
  rest: 10,
  exercises: [
    'exercise.airSquat',
    'exercise.pushUp',
    'exercise.jumpingJacks',
    'exercise.bicycleCrunch',
    'exercise.reverseLunge',
    'exercise.shoulderTap',
    'exercise.highKnees',
    'exercise.mountainClimber'
  ]
};

/** Presets in the order the editor offers them; they stay there even after their workouts were deleted. */
const ALL = [CIRCUIT, TABATA];

/** @type {readonly { id: string, name: string }[]} */
export const PRESETS = Object.freeze(ALL.map(({ id, name }) => Object.freeze({ id, name })));

/**
 * Build a new workout from a preset.
 *
 * @param {string} id Identifier of the preset.
 * @returns {import('./workout.js').Workout | null} The workout, with exercise names in the language in use, or null for an unknown preset.
 */
export const createFromPreset = (id) => {
  const preset = ALL.find((candidate) => candidate.id === id);

  if (!preset) return null;

  const { name, intensity, work, rest, exercises } = preset;

  return {
    ...createWorkout(
      name,
      exercises.map((key) => createExercise(t(key), work))
    ),
    intensity,
    rest
  };
};

/**
 * The ready-made workouts that a new device starts with: one of every preset.
 *
 * @returns {import('./workout.js').Workout[]} The workouts, with exercise names in the language in use.
 */
export const createStarterWorkouts = () => PRESETS.map(({ id }) => createFromPreset(id));
