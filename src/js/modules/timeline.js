import { MS } from './time.js';

/** Seconds at the end of each phase that get a tick cue and a clock pulse, unless the settings say otherwise. */
export const COUNTDOWN_SECONDS = 3;

/** Most seconds the countdown setting allows. */
export const MAX_COUNTDOWN = 5;

/**
 * @typedef {import('./workout.js').Step} Step
 * @typedef {{ steps: Step[], starts: number[], total: number }} Timeline
 * @typedef {'tick' | 'work' | 'rest' | 'round' | 'done'} CueKind
 * @typedef {{ at: number, kind: CueKind }} Cue
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
 * Work out where a jump to the next or the previous step leads. Going back restarts the current step first, unless it
 * has only just begun.
 *
 * @param {Timeline} timeline Timeline to move along.
 * @param {number} at Active milliseconds the workout has reached.
 * @param {number} delta Steps to move: 1 for the next and -1 for the previous.
 * @param {number} restartAfter Milliseconds into a step after which going back only restarts that step.
 * @returns {number | null} Active milliseconds to jump to, or null when there is nowhere further to go.
 */
export const stepTarget = (timeline, at, delta, restartAfter) => {
  const { index, finished } = locate(timeline, at);
  const last = timeline.steps.length - 1;

  if (finished && delta > 0) return null;

  if (!finished && delta > 0 && index === last) return timeline.total;

  const restart = !finished && delta < 0 && at - timeline.starts[index] > restartAfter;
  const target = finished ? last : Math.min(last, Math.max(0, index + (restart ? 0 : delta)));

  return timeline.starts[target];
};

/**
 * List the sounds to play: a countdown for the last seconds of every step, a signal when work, rest or round rest
 * begins and a finish signal.
 *
 * @param {Timeline} timeline Timeline to scan.
 * @param {number} [countdown] Seconds at the end of every step that get a tick.
 * @returns {Cue[]} Cues in time order.
 */
export const buildCues = ({ steps, starts, total }, countdown = COUNTDOWN_SECONDS) => {
  /** @type {Cue[]} */
  const cues = [];

  steps.forEach((step, index) => {
    const start = starts[index];
    const end = start + step.duration * MS;

    if (step.type !== 'prepare') cues.push({ at: start, kind: step.type });

    for (let left = countdown; left >= 1; left -= 1) {
      if (step.duration > left) cues.push({ at: end - left * MS, kind: 'tick' });
    }
  });

  cues.push({ at: total, kind: 'done' });

  return cues.sort((a, b) => a.at - b.at);
};
