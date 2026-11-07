import { currentStreak, finishedThisWeek, weekDays } from './calendar.js';
import { count, getLocale, list, t } from './i18n.js';
import * as library from './library.js';
import * as preferences from './preferences.js';

/** Both languages of the app start the week on Monday. */
const FIRST_DAY = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {Date} now The current moment.
 * @returns {string[]} The names of the days of the current week in the language in use, from Monday.
 */
const dayNames = (now) => {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7), 12);
  const format = new Intl.DateTimeFormat(getLocale(), { weekday: 'long' });

  // Noon keeps every step of a day inside the next date, also on the days the clock changes.
  return Array.from({ length: 7 }, (_, offset) => format.format(new Date(monday.getTime() + offset * DAY_MS)));
};

/**
 * The streak of the home screen: with a weekly goal, the days in a row with a workout, the workouts of this week
 * against the goal and a bar for every day of the week; without one, a card that suggests setting it, which can be
 * dismissed for good. Both are drawn whenever the screen shows.
 *
 * @param {string} [selector] Selector of the home screen.
 * @returns {void}
 */
export const init = (selector = '[data-screen="workouts"]') => {
  const screen = /** @type {HTMLElement | null} */ (document.querySelector(selector));
  const row = /** @type {HTMLElement | null} */ (screen?.querySelector('[data-streak="row"]'));
  const hint = /** @type {HTMLElement | null} */ (screen?.querySelector('[data-notice="streak"]'));

  if (!screen || !row || !hint) return;

  const part = (name) => /** @type {HTMLElement} */ (row.querySelector(`[data-part="${name}"]`));
  const week = part('week');

  const showRow = (goal, now) => {
    const completions = library.getCompletions();
    const done = weekDays(completions, now, FIRST_DAY);
    const finished = finishedThisWeek(completions, now, FIRST_DAY);
    const names = dayNames(now).filter((_, index) => done[index]);

    part('days').textContent = String(currentStreak(completions, now));
    part('weekly').textContent = t('home.weekly', { done: finished, goal: count('count.goalWorkouts', goal) });
    week.replaceChildren(
      ...done.map((day) => {
        const bar = document.createElement('span');

        bar.classList.add('streak__day');
        bar.classList.toggle('streak__day--done', day);

        return bar;
      })
    );
    week.setAttribute(
      'aria-label',
      names.length > 0
        ? t('home.week', { count: count('count.workouts', finished), days: list(names) })
        : t('home.weekEmpty')
    );
  };

  const show = () => {
    const { weeklyGoal, streakHint } = preferences.get();

    row.hidden = weeklyGoal === 0;
    hint.hidden = weeklyGoal > 0 || !streakHint;

    if (weeklyGoal > 0) showRow(weeklyGoal, new Date());
  };

  hint.querySelector('[data-action="dismiss-streak"]').addEventListener('click', () => {
    preferences.update({ streakHint: false });
    show();
  });

  screen.addEventListener('screen:show', show);
};
