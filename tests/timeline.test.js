import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildCues, buildTimeline, locate, stepTarget } from '../src/js/modules/timeline.js';
import { buildSteps, createDefaultWorkout, totalSeconds } from '../src/js/modules/workout.js';

const MS = 1000;

test('the default workout is a countdown, nine 30 s exercises and eight 30 s rests', () => {
  const workout = createDefaultWorkout();
  const steps = buildSteps(workout);

  assert.equal(steps.length, 1 + 9 + 8);
  assert.equal(totalSeconds(workout), 10 + 9 * 30 + 8 * 30);
  assert.deepEqual(
    steps.slice(0, 4).map(({ type, exercise }) => [type, exercise]),
    [
      ['prepare', 0],
      ['work', 0],
      ['rest', 1],
      ['work', 1]
    ]
  );
});

test('rounds add a round rest between rounds but not after the last', () => {
  const workout = { ...createDefaultWorkout(), rounds: 3 };
  const steps = buildSteps(workout);

  assert.equal(steps.filter((step) => step.type === 'round').length, 2);
  assert.equal(steps.at(-1).type, 'work');
  assert.equal(totalSeconds(workout), 10 + 3 * (9 * 30 + 8 * 30) + 2 * 60);
});

test('steps with no time are left out', () => {
  const workout = { ...createDefaultWorkout(), prepare: 0, rest: 0 };
  const steps = buildSteps(workout);

  assert.equal(steps.length, 9);
  assert.ok(steps.every((step) => step.type === 'work'));
});

test('locate maps elapsed time to a step and the time left in it', () => {
  const timeline = buildTimeline(buildSteps(createDefaultWorkout()));

  assert.deepEqual(locate(timeline, 0), { index: 0, remaining: 10 * MS, finished: false });
  assert.deepEqual(locate(timeline, 10 * MS - 1), { index: 0, remaining: 1, finished: false });
  assert.deepEqual(locate(timeline, 10 * MS), { index: 1, remaining: 30 * MS, finished: false });
  assert.deepEqual(locate(timeline, 40 * MS), { index: 2, remaining: 30 * MS, finished: false });
  assert.equal(locate(timeline, timeline.total - 1).finished, false);
  assert.deepEqual(locate(timeline, timeline.total), { index: 17, remaining: 0, finished: true });
  assert.equal(locate(timeline, timeline.total + 5 * MS).finished, true);
});

test('cues: a countdown per step, a signal per work, rest or round rest, and one finish', () => {
  const workout = { ...createDefaultWorkout(), rounds: 2 };
  const timeline = buildTimeline(buildSteps(workout));
  const cues = buildCues(timeline);
  const count = (kind) => cues.filter((cue) => cue.kind === kind).length;

  assert.equal(count('work'), 18);
  assert.equal(count('rest'), 16);
  assert.equal(count('round'), 1);
  assert.equal(count('done'), 1);
  assert.equal(count('tick'), timeline.steps.length * 3);
  assert.deepEqual(
    cues.slice(0, 3).map((cue) => cue.at),
    [7 * MS, 8 * MS, 9 * MS]
  );
  assert.equal(cues.at(-1).at, timeline.total);
  assert.ok(cues.every((cue, index) => index === 0 || cue.at >= cues[index - 1].at));
});

test('a step shorter than the countdown only counts down what fits', () => {
  const timeline = buildTimeline([{ type: 'work', duration: 2, exercise: 0, round: 0 }]);
  const ticks = buildCues(timeline).filter((cue) => cue.kind === 'tick');

  assert.deepEqual(
    ticks.map((cue) => cue.at),
    [MS]
  );
});

const RESTART_AFTER = 2 * MS;

/** The default workout laid out on its timeline: a 10 s countdown, then 30 s exercises and rests. */
const defaultTimeline = () => buildTimeline(buildSteps(createDefaultWorkout()));

test('next leads to the start of the following step', () => {
  const timeline = defaultTimeline();

  assert.equal(stepTarget(timeline, 4 * MS, 1, RESTART_AFTER), 10 * MS);
  assert.equal(stepTarget(timeline, 25 * MS, 1, RESTART_AFTER), 40 * MS);
});

test('previous restarts a step that is well under way, and goes back when it has only begun', () => {
  const timeline = defaultTimeline();

  assert.equal(stepTarget(timeline, 25 * MS, -1, RESTART_AFTER), 10 * MS);
  assert.equal(stepTarget(timeline, 10 * MS + RESTART_AFTER, -1, RESTART_AFTER), 0);
  assert.equal(stepTarget(timeline, 10 * MS + RESTART_AFTER + 1, -1, RESTART_AFTER), 10 * MS);
});

test('previous from the first step stays at the start', () => {
  assert.equal(stepTarget(defaultTimeline(), 0, -1, RESTART_AFTER), 0);
  assert.equal(stepTarget(defaultTimeline(), MS, -1, RESTART_AFTER), 0);
});

test('next from the last step leads to the end, and from the end nowhere', () => {
  const timeline = defaultTimeline();
  const lastStart = timeline.starts.at(-1);

  assert.equal(stepTarget(timeline, lastStart + 5 * MS, 1, RESTART_AFTER), timeline.total);
  assert.equal(stepTarget(timeline, timeline.total, 1, RESTART_AFTER), null);
});

test('previous from the end leads to the start of the last step', () => {
  const timeline = defaultTimeline();

  assert.equal(stepTarget(timeline, timeline.total, -1, RESTART_AFTER), timeline.starts.at(-1));
});
