import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  currentStreak,
  daysInMonth,
  finishedThisWeek,
  groupByDay,
  leadingBlanks,
  summarise,
  weekDays,
  yearRange
} from '../src/js/modules/calendar.js';

/**
 * @param {number} year Full year.
 * @param {number} month Month, from 0 for January.
 * @param {number} day Day of the month.
 * @param {string} name Workout name, which is also its identifier here.
 * @returns {import('../src/js/modules/calendar.js').Completion} A 60 s workout finished at noon local time on that day.
 */
const finished = (year, month, day, name = 'green') => ({
  id: name,
  name,
  at: new Date(year, month, day, 12).getTime(),
  seconds: 60
});

test('a month has the right number of days, leap years included', () => {
  assert.equal(daysInMonth(2026, 0), 31);
  assert.equal(daysInMonth(2026, 1), 28);
  assert.equal(daysInMonth(2028, 1), 29);
});

test('completions are sorted into the days of their month and others are ignored', () => {
  const days = groupByDay(
    [finished(2026, 4, 3), finished(2026, 4, 3, 'pink'), finished(2026, 4, 31), finished(2026, 5, 1)],
    2026,
    4
  );

  assert.equal(days.length, 31);
  assert.equal(days[2].length, 2);
  assert.equal(days[30].length, 1);
  assert.equal(days.flat().length, 3);
});

test('a completion just before local midnight stays on its own day', () => {
  const late = { id: 'a', name: 'a', at: new Date(2026, 4, 3, 23, 59, 59).getTime(), seconds: 60 };

  assert.equal(groupByDay([late], 2026, 4)[2].length, 1);
  assert.equal(groupByDay([late], 2026, 4)[3].length, 0);
});

test('the blank columns depend on the day the week starts on', () => {
  // 1 May 2026 is a Friday.
  assert.equal(leadingBlanks(2026, 4, 1), 4);
  assert.equal(leadingBlanks(2026, 4, 0), 5);
  assert.equal(leadingBlanks(2026, 4, 5), 0);
});

test('the years run from the earliest completion to the current year', () => {
  assert.deepEqual(yearRange([], 2026), [2026]);
  assert.deepEqual(yearRange([finished(2024, 2, 1), finished(2025, 0, 1)], 2026), [2024, 2025, 2026]);
});

test('a summary counts the workouts, adds up their time and names the most frequent one', () => {
  const [a, b] = [finished(2026, 0, 1, 'green'), finished(2026, 0, 2, 'blue')];

  assert.deepEqual(summarise([]), { count: 0, seconds: 0, top: null });
  assert.deepEqual(summarise([{ ...a, seconds: 60 }, b, { ...a, seconds: 30 }]), {
    count: 3,
    seconds: 150,
    top: { name: 'green', count: 2 }
  });
  // With equal counts the workout finished last wins.
  assert.equal(summarise([a, b]).top.name, 'blue');
});

test('the streak counts the days in a row up to today, or up to yesterday while today is still open', () => {
  const now = new Date(2026, 4, 10, 8);
  const days = [8, 9, 10].map((day) => finished(2026, 4, day));

  assert.equal(currentStreak([], now), 0);
  assert.equal(currentStreak(days, now), 3);
  assert.equal(currentStreak(days.slice(0, 2), now), 2);
  assert.equal(currentStreak([finished(2026, 4, 7)], now), 0);
  // A gap ends the streak, and two workouts on a day count as one day.
  assert.equal(currentStreak([finished(2026, 4, 10), finished(2026, 4, 10), finished(2026, 4, 8)], now), 1);
});

test('the streak runs across month and year ends', () => {
  const now = new Date(2026, 0, 1, 8);

  assert.equal(currentStreak([finished(2025, 11, 30), finished(2025, 11, 31), finished(2026, 0, 1)], now), 3);
});

test('the streak keeps whole days across a change of the clock', () => {
  // The clocks went forward on 29 March 2026 in Central Europe, which made that day 23 hours long.
  const now = new Date(2026, 2, 30, 8);

  assert.equal(
    currentStreak(
      [28, 29, 30].map((day) => finished(2026, 2, day)),
      now
    ),
    3
  );
});

test('the week starts on the chosen day', () => {
  // 13 May 2026 is a Wednesday.
  const now = new Date(2026, 4, 13, 8);
  const sunday = finished(2026, 4, 10);
  const monday = finished(2026, 4, 11);

  // From Monday the week holds 11 and 17, from Sunday it holds 10 and 11.
  assert.equal(finishedThisWeek([sunday, monday, finished(2026, 4, 17)], now, 1), 2);
  assert.equal(finishedThisWeek([sunday], now, 1), 0);
  assert.equal(finishedThisWeek([sunday, monday, finished(2026, 4, 17)], now, 0), 2);
  assert.equal(finishedThisWeek([sunday], now, 0), 1);
  assert.equal(finishedThisWeek([], now, 1), 0);
});

test('the week shows which of its days have a finished workout', () => {
  // 13 May 2026 is a Wednesday; from Monday the week runs from 11 to 17 May.
  const now = new Date(2026, 4, 13, 8);
  const days = weekDays(
    [finished(2026, 4, 10), finished(2026, 4, 11), finished(2026, 4, 11), finished(2026, 4, 14)],
    now,
    1
  );

  assert.deepEqual(days, [true, false, false, true, false, false, false]);
  assert.deepEqual(weekDays([], now, 1), Array(7).fill(false));
});
