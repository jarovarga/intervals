import { MS } from './time.js';

/** Seconds at the end of each phase that get a tick cue and a clock pulse. */
export const COUNTDOWN_SECONDS = 3;

/**
 * @typedef {import('./workout.js').Step} Step
 * @typedef {{ steps: Step[], starts: number[], total: number }} Timeline
 * @typedef {{ at: number, kind: 'tick' | 'work' | 'rest' | 'round' | 'done' }} Cue
 */

/**
 * Lay the steps out on a single time axis in milliseconds, so that any position maps to one step.
 *
 * @param {Step[]} steps Steps in running order.
 * @returns {Timeline} Start offset of every step and the total length.
 */
export const buildTimeline = (steps) => {
  let end = 0;
  const starts = steps.map((step) => {
    const start = end;
    end += step.duration * MS;

    return start;
  });

  return { steps, starts, total: end };
};

/**
 * Find where an elapsed time falls.
 *
 * @param {Timeline} timeline Timeline to search.
 * @param {number} elapsed Active milliseconds since the start.
 * @returns {{ index: number, remaining: number, finished: boolean }} Step index and milliseconds left in it.
 */
export const locate = ({ steps, starts, total }, elapsed) => {
  if (elapsed >= total) return { index: steps.length - 1, remaining: 0, finished: true };

  const position = Math.max(0, elapsed);
  let index = steps.length - 1;

  while (starts[index] > position) index -= 1;

  return { index, remaining: starts[index] + steps[index].duration * MS - position, finished: false };
};

/**
 * List the sounds to play: a countdown for the last three seconds of every step, a signal when work, rest or round
 * rest begins and a finish signal.
 *
 * @param {Timeline} timeline Timeline to scan.
 * @returns {Cue[]} Cues in time order.
 */
export const buildCues = ({ steps, starts, total }) => {
  /** @type {Cue[]} */
  const cues = [];

  steps.forEach((step, index) => {
    const start = starts[index];
    const end = start + step.duration * MS;

    if (step.type !== 'prepare') cues.push({ at: start, kind: step.type });

    for (let left = COUNTDOWN_SECONDS; left >= 1; left -= 1) {
      if (step.duration > left) cues.push({ at: end - left * MS, kind: 'tick' });
    }
  });

  cues.push({ at: total, kind: 'done' });

  return cues.sort((a, b) => a.at - b.at);
};
