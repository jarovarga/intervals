import { count, t } from './i18n.js';
import { format } from './time.js';

/** Key of the name of every phase that the timer shows. */
const PHASE_KEYS = {
  prepare: 'phase.prepare',
  work: 'phase.work',
  rest: 'phase.rest',
  round: 'phase.round',
  done: 'phase.done'
};

/**
 * @typedef {import('./workout.js').Step} Step
 * @typedef {{ label: string, text: string, time: string }} Next
 * @typedef {{ phase: string, title: string, name: string, note: string, round: string, next: Next | null }} Display
 * @typedef {{ steps: Step[], names: string[], rounds: number, workout: string, index: number, finished: boolean }} Situation
 */

/**
 * @param {string} phase Phase of a step or `done`.
 * @returns {string} What the timer calls it in the language in use.
 */
export const phaseName = (phase) => t(PHASE_KEYS[phase]);

/**
 * @param {Step} step A work step.
 * @param {number} rounds Rounds of the workout.
 * @returns {string} Such as `Round 2 of 3`.
 */
const roundOf = (step, rounds) => t('timer.round', { n: step.round + 1, total: rounds });

/**
 * Say what follows the exercise in view: the next exercise, or a rest or cooldown and the exercise after it.
 *
 * @param {Situation} situation Where the workout stands.
 * @returns {Next} The line under the round.
 */
const afterWork = ({ steps, names, index }) => {
  const after = steps[index + 1];
  const label = t('timer.next');

  if (!after) return { label, text: phaseName('done'), time: '' };
  if (after.type === 'work') return { label, text: names[after.exercise], time: format(after.duration) };

  const work = steps.slice(index + 2).find((step) => step.type === 'work');
  const text = work ? t('timer.thenNamed', { phase: phaseName(after.type), name: names[work.exercise] }) : '';

  return { label, text: text || phaseName(after.type), time: format(after.duration) };
};

/**
 * Say what the timer shows for the step in view. During an exercise it names that exercise; during get ready, a rest
 * or a cooldown it names the exercise that comes next, which also sets the round. A finished workout shows its name
 * and size.
 *
 * @param {Situation} situation Steps, exercise names, rounds and name of the workout, and where it stands.
 * @returns {Display} Phase, the name of the phase, the name and note in focus, the round and what follows.
 */
export const describe = (situation) => {
  const { steps, names, rounds, workout, index, finished } = situation;

  if (finished) {
    return {
      phase: 'done',
      title: phaseName('done'),
      name: workout,
      note: `${count('count.exercises', names.length)} · ${count('count.rounds', rounds)}`,
      round: '',
      next: null
    };
  }

  const step = steps[index];

  if (step.type === 'work') {
    return {
      phase: 'work',
      title: phaseName('work'),
      name: names[step.exercise],
      note: t('timer.exerciseOf', { n: step.exercise + 1, total: names.length }),
      round: roundOf(step, rounds),
      next: afterWork(situation)
    };
  }

  const work = steps.slice(index + 1).find((later) => later.type === 'work');

  return {
    phase: step.type,
    title: phaseName(step.type),
    name: work ? names[work.exercise] : '',
    note: t('timer.upNext'),
    round: work ? roundOf(work, rounds) : '',
    next: work ? { label: t('timer.then'), text: names[work.exercise], time: format(work.duration) } : null
  };
};
