import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { setLanguage } from '../src/js/modules/i18n.js';
import { describe } from '../src/js/modules/phase.js';
import { buildSteps, createExercise, createWorkout } from '../src/js/modules/workout.js';

afterEach(() => setLanguage('en'));

/** Leg day: 10 s get ready, three exercises with 15 s rest, two rounds with a 60 s cooldown. */
const LEG_DAY = {
  ...createWorkout('Leg day', [
    createExercise('Squats', 45),
    createExercise('Lunges', 40),
    createExercise('Wall sit', 60)
  ]),
  prepare: 10,
  rest: 15,
  rounds: 2,
  roundRest: 60
};

/**
 * @param {import('../src/js/modules/workout.js').Workout} workout Workout to run.
 * @returns {{ situation: (index: number, finished?: boolean) => object, steps: object[] }} What the timer hands over.
 */
const run = (workout) => {
  const steps = buildSteps(workout);
  const names = workout.exercises.map(({ name }) => name);

  return {
    steps,
    situation: (index, finished = false) => ({
      steps,
      names,
      rounds: workout.rounds,
      workout: workout.name,
      index,
      finished
    })
  };
};

test('get ready names the first exercise and its round', () => {
  const { situation } = run(LEG_DAY);

  assert.deepEqual(describe(situation(0)), {
    phase: 'prepare',
    title: 'Get ready',
    name: 'Squats',
    note: 'Up next',
    round: 'Round 1 of 2',
    next: { label: 'Then', text: 'Squats', time: '0:45' }
  });
});

test('an exercise names itself and the rest and exercise that follow', () => {
  const { situation } = run(LEG_DAY);

  assert.deepEqual(describe(situation(1)), {
    phase: 'work',
    title: 'Work',
    name: 'Squats',
    note: 'Exercise 1 of 3',
    round: 'Round 1 of 2',
    next: { label: 'Next', text: 'Rest, then Lunges', time: '0:15' }
  });
});

test('a rest names the exercise that comes next', () => {
  const { situation } = run(LEG_DAY);
  const display = describe(situation(2));

  assert.equal(display.title, 'Rest');
  assert.equal(display.name, 'Lunges');
  assert.equal(display.note, 'Up next');
  assert.deepEqual(display.next, { label: 'Then', text: 'Lunges', time: '0:40' });
});

test('the last exercise of a round leads to the cooldown, which belongs to the next round', () => {
  const { situation, steps } = run(LEG_DAY);
  const cooldown = steps.findIndex(({ type }) => type === 'round');

  assert.deepEqual(describe(situation(cooldown - 1)).next, {
    label: 'Next',
    text: 'Cooldown, then Squats',
    time: '1:00'
  });

  const display = describe(situation(cooldown));

  assert.equal(display.title, 'Cooldown');
  assert.equal(display.name, 'Squats');
  assert.equal(display.round, 'Round 2 of 2');
});

test('an exercise without rest leads straight to the next one', () => {
  const { situation } = run({ ...LEG_DAY, prepare: 0, rest: 0 });

  assert.deepEqual(describe(situation(0)).next, { label: 'Next', text: 'Lunges', time: '0:40' });
});

test('the last exercise leads to the end', () => {
  const { situation, steps } = run(LEG_DAY);

  assert.deepEqual(describe(situation(steps.length - 1)).next, { label: 'Next', text: 'Done', time: '' });
});

test('a finished workout shows its name, exercises and rounds', () => {
  const { situation } = run(LEG_DAY);
  const display = describe(situation(0, true));

  assert.equal(display.title, 'Done');
  assert.equal(display.name, 'Leg day');
  // The count joins its number and word with a non-breaking space.
  assert.match(display.note, /^3\sexercises · 2\srounds$/u);
  assert.equal(display.next, null);
});

test('the texts follow the language in use', () => {
  const { situation } = run(LEG_DAY);

  setLanguage('sk');

  const display = describe(situation(1));

  assert.equal(display.title, 'Cvičenie');
  assert.equal(display.note, 'Cvik 1 z 3');
  assert.equal(display.next.text, 'Oddych, potom Lunges');
});
