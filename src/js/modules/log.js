import { FIRST_DAY, groupByDay, leadingBlanks, summarise, yearRange } from './calendar.js';
import { count, getLocale } from './i18n.js';
import * as library from './library.js';
import { format } from './time.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {string} locale BCP 47 tag of the language in use.
 * @returns {string[]} Short names of the days of the week from Monday, such as `Mon`.
 */
const weekdayNames = (locale) => {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  // 2 January 2023 was a Monday; noon keeps every step inside the next date.
  const monday = Date.UTC(2023, 0, 2, 12);

  return Array.from({ length: 7 }, (_, offset) => formatter.format(new Date(monday + offset * DAY_MS)));
};

/**
 * The log screen: a month to choose, its calendar with the days that have a finished workout, a summary of the month
 * and the finished workouts of the month, newest first. It shows the current month whenever the screen opens.
 *
 * @param {string} [selector] Selector of the log screen.
 * @returns {void}
 */
export const init = (selector = '[data-screen="log"]') => {
  const screen = /** @type {HTMLElement | null} */ (document.querySelector(selector));

  if (!screen) return;

  const field = (name) => /** @type {HTMLSelectElement} */ (screen.querySelector(`[data-field="${name}"]`));
  const list = (name) => /** @type {HTMLElement} */ (screen.querySelector(`[data-list="${name}"]`));
  const stat = (name) => /** @type {HTMLElement} */ (screen.querySelector(`[data-stat="${name}"]`));
  const empty = /** @type {HTMLElement} */ (screen.querySelector('[data-empty="history"]'));
  const month = field('month');
  const year = field('year');

  const fillChoices = (now) => {
    const locale = getLocale();
    const monthName = new Intl.DateTimeFormat(locale, { month: 'long' });

    month.replaceChildren(
      ...Array.from({ length: 12 }, (_, index) => new Option(monthName.format(new Date(2023, index, 1)), String(index)))
    );
    year.replaceChildren(
      ...yearRange(library.getCompletions(), now.getFullYear()).map((value) => new Option(String(value), String(value)))
    );
  };

  /**
   * @param {number} y Full year.
   * @param {number} m Month, from 0 for January.
   * @param {import('./calendar.js').Completion[][]} days Completions of every day of the month.
   * @param {Date} now The current moment.
   * @returns {void}
   */
  const showCalendar = (y, m, days, now) => {
    const isToday = (day) => y === now.getFullYear() && m === now.getMonth() && day === now.getDate();
    const isFuture = (day) => new Date(y, m, day) > now;
    const blanks = Array.from({ length: leadingBlanks(y, m, FIRST_DAY) }, () => document.createElement('li'));

    list('weekdays').replaceChildren(
      ...weekdayNames(getLocale()).map((name) => {
        const item = document.createElement('li');

        item.textContent = name;

        return item;
      })
    );
    list('days').replaceChildren(
      ...blanks,
      ...days.map((finished, index) => {
        const day = index + 1;
        const item = document.createElement('li');

        item.classList.add('log__day');
        item.classList.toggle('log__day--done', finished.length > 0);
        item.classList.toggle('log__day--today', isToday(day));
        item.classList.toggle('log__day--future', isFuture(day));
        item.textContent = String(day);

        // The colour says that a day has a workout; the hidden count says it without colour.
        if (finished.length > 0) {
          const note = document.createElement('span');

          note.classList.add('visually-hidden');
          note.textContent = `, ${count('count.workouts', finished.length)}`;
          item.append(note);
        }

        return item;
      })
    );
    blanks.forEach((blank) => blank.setAttribute('aria-hidden', 'true'));
  };

  /**
   * @param {import('./calendar.js').Completion[]} completions Completions of the month.
   * @returns {void}
   */
  const showSummary = (completions) => {
    const { count: finished, seconds, top } = summarise(completions);

    stat('count').textContent = String(finished);
    stat('time').textContent = format(seconds);
    stat('top').textContent = top?.name ?? '–';
  };

  /**
   * @param {import('./calendar.js').Completion[]} completions Completions of the month.
   * @returns {void}
   */
  const showHistory = (completions) => {
    const date = new Intl.DateTimeFormat(getLocale(), { weekday: 'short', day: 'numeric', month: 'short' });

    list('history').replaceChildren(
      ...completions
        .toSorted((a, b) => b.at - a.at)
        .map(({ name, at, seconds }) => {
          const item = document.createElement('li');
          const text = document.createElement('span');
          const title = document.createElement('span');
          const when = document.createElement('time');
          const time = document.createElement('span');

          item.classList.add('log__entry');
          text.classList.add('log__entry-text');
          title.classList.add('log__entry-name');
          title.textContent = name;
          when.classList.add('log__entry-date');
          when.dateTime = new Date(at).toISOString();
          when.textContent = date.format(new Date(at));
          time.classList.add('log__entry-time');
          time.textContent = format(seconds);
          text.append(title, when);
          item.append(text, time);

          return item;
        })
    );
    empty.hidden = completions.length > 0;
  };

  const show = () => {
    const y = Number(year.value);
    const m = Number(month.value);
    const days = groupByDay(library.getCompletions(), y, m);
    const completions = days.flat();

    showCalendar(y, m, days, new Date());
    showSummary(completions);
    showHistory(completions);
  };

  month.addEventListener('change', show);
  year.addEventListener('change', show);

  screen.addEventListener('screen:show', () => {
    const now = new Date();

    fillChoices(now);
    month.value = String(now.getMonth());
    year.value = String(now.getFullYear());
    show();
  });
};
