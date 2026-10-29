import { count } from './plural.js';
import { formatField, formatTotal, MS } from './time.js';

/** What the timer calls each phase. */
export const PHASE_LABELS = {
  prepare: 'Get ready',
  work: 'Work',
  rest: 'Rest',
  round: 'Cooldown',
  done: 'Done'
};

/**
 * @typedef {{ phase: string, heading: string, title: string, sub: string, then: string }} NextStep
 */

const LAST_STEP = { phase: 'done', heading: 'Up next', title: 'End of workout', sub: 'Final interval', then: '' };

/**
 * Say what the "up next" band shows about the step after the current one.
 *
 * @param {object} situation Where the workout stands.
 * @param {import('./workout.js').Step[]} situation.steps Steps in running order.
 * @param {string[]} situation.names Exercise names.
 * @param {number} situation.index Current step.
 * @param {boolean} situation.finished Whether the workout is over.
 * @param {number} situation.total Length of the workout in milliseconds.
 * @returns {NextStep} Colour phase, heading, title, and the line below with the exercise that follows a cooldown.
 */
export const describeNext = ({ steps, names, index, finished, total }) => {
  if (finished) {
    const summary = `${count(names.length, 'exercise', 'exercises')} · ${formatTotal(total / MS)}`;

    return { ...LAST_STEP, phase: 'work', heading: 'Workout complete', title: 'Well done', sub: summary };
  }

  const after = steps[index + 1];

  if (!after) return LAST_STEP;

  if (after.type === 'work') {
    return {
      ...LAST_STEP,
      phase: 'work',
      title: names[after.exercise],
      sub: `Exercise ${after.exercise + 1} of ${names.length}`
    };
  }

  const title = `${PHASE_LABELS[after.type]} ${formatField(after.duration)}`;

  // A rest is counted, and it follows exercise number `after.exercise`, so it is that rest of the round.
  if (after.type === 'rest') {
    return { ...LAST_STEP, phase: 'rest', title, sub: `Rest ${after.exercise} of ${names.length - 1}` };
  }

  // Only a cooldown says which exercise starts the next round.
  const work =
    after.type === 'round' ? steps.find((step, position) => position > index + 1 && step.type === 'work') : undefined;

  return { ...LAST_STEP, phase: after.type, title, sub: work ? 'Then ' : '', then: work ? names[work.exercise] : '' };
};
