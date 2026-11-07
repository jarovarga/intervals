/**
 * A finished workout from the log, at a UTC time in milliseconds; the day it belongs to is the one on the user's
 * calendar.
 *
 * @typedef {import('./library.js').Completion} Completion
 */

const DAYS_PER_WEEK = 7;

/**
 * @param {number} year Full year.
 * @param {number} month Month, from 0 for January.
 * @returns {number} How many days the month has.
 */
export const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

/**
 * Sort the completions of one month into its days, by the local calendar day on which each one was finished.
 *
 * @param {Completion[]} completions Every completion.
 * @param {number} year Full year.
 * @param {number} month Month, from 0 for January.
 * @returns {Completion[][]} One list per day of the month, the first for day 1.
 */
export const groupByDay = (completions, year, month) => {
  const days = Array.from({ length: daysInMonth(year, month) }, () => []);

  completions.forEach((completion) => {
    const date = new Date(completion.at);

    if (date.getFullYear() === year && date.getMonth() === month) {
      days[date.getDate() - 1].push(completion);
    }
  });

  return days;
};

/**
 * @param {number} year Full year.
 * @param {number} month Month, from 0 for January.
 * @param {number} firstDay Day the week starts on, from 0 for Sunday.
 * @returns {number} How many empty columns come before day 1 of the month.
 */
export const leadingBlanks = (year, month, firstDay) =>
  (new Date(year, month, 1).getDay() - firstDay + DAYS_PER_WEEK) % DAYS_PER_WEEK;

/**
 * @param {Completion[]} completions Every completion.
 * @param {number} currentYear The year to end on.
 * @returns {number[]} The years to choose from, from the year of the earliest completion up to the current year.
 */
export const yearRange = (completions, currentYear) => {
  const earliest = completions.reduce(
    (year, completion) => Math.min(year, new Date(completion.at).getFullYear()),
    currentYear
  );

  return Array.from({ length: currentYear - earliest + 1 }, (_, index) => earliest + index);
};

/**
 * @param {Completion[]} completions Completions to add up.
 * @returns {{ count: number, seconds: number, top: { name: string, count: number } | null }} How many were finished,
 *   their total time and the workout finished most often, the one finished last among equals.
 */
export const summarise = (completions) => {
  const counts = new Map();
  let seconds = 0;

  completions.forEach(({ id, name, at, seconds: duration }) => {
    const entry = counts.get(id) ?? { name, count: 0, at };

    counts.set(id, { name: at >= entry.at ? name : entry.name, count: entry.count + 1, at: Math.max(at, entry.at) });
    seconds += duration;
  });

  const [top = null] = [...counts.values()].sort((a, b) => b.count - a.count || b.at - a.at);

  return { count: completions.length, seconds, top: top && { name: top.name, count: top.count } };
};

/**
 * @param {Date} date A moment.
 * @returns {string} The local calendar day it falls on.
 */
const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/**
 * A day without a workout ends the streak, except today: the streak still stands while today's workout is to come.
 *
 * @param {Completion[]} completions Every completion.
 * @param {Date} now The current moment.
 * @returns {number} How many days in a row, ending today or yesterday, have a finished workout.
 */
export const currentStreak = (completions, now) => {
  const done = new Set(completions.map(({ at }) => dayKey(new Date(at))));
  // Stepping through calendar days, not 24-hour spans, keeps the days that change the clock whole.
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let streak = 0;

  if (!done.has(dayKey(day))) day.setDate(day.getDate() - 1);

  while (done.has(dayKey(day))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }

  return streak;
};

/**
 * @param {Date} now The current moment.
 * @param {number} firstDay Day the week starts on, from 0 for Sunday.
 * @returns {Date} Midnight at the start of the current week, local time.
 */
const weekStart = (now, firstDay) => {
  const back = (now.getDay() - firstDay + DAYS_PER_WEEK) % DAYS_PER_WEEK;

  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
};

/**
 * @param {Completion[]} completions Every completion.
 * @param {Date} now The current moment.
 * @param {number} firstDay Day the week starts on, from 0 for Sunday.
 * @returns {number} How many workouts were finished in the current week.
 */
export const finishedThisWeek = (completions, now, firstDay) => {
  const start = weekStart(now, firstDay);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + DAYS_PER_WEEK);

  return completions.filter(({ at }) => at >= start.getTime() && at < end.getTime()).length;
};

/**
 * @param {Completion[]} completions Every completion.
 * @param {Date} now The current moment.
 * @param {number} firstDay Day the week starts on, from 0 for Sunday.
 * @returns {boolean[]} For each day of the current week, from its first day on, whether a workout was finished.
 */
export const weekDays = (completions, now, firstDay) => {
  const done = new Set(completions.map(({ at }) => dayKey(new Date(at))));
  const start = weekStart(now, firstDay);

  // Counting calendar days, not 24-hour spans, keeps the days that change the clock whole.
  return Array.from({ length: DAYS_PER_WEEK }, (_, offset) =>
    done.has(dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset)))
  );
};
