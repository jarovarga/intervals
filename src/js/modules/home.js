import * as library from './library.js';
import { count } from './plural.js';
import * as presets from './presets.js';
import * as sound from './sound.js';
import { formatTotal } from './time.js';
import * as wakeLock from './wake-lock.js';
import { totalSeconds } from './workout.js';

/**
 * @param {import('./workout.js').Workout} workout Workout to describe.
 * @returns {string} Exercise count, rounds and total time.
 */
const describe = (workout) =>
  [
    count(workout.exercises.length, 'exercise', 'exercises'),
    count(workout.rounds, 'round', 'rounds'),
    formatTotal(totalSeconds(workout))
  ].join(' · ');

const TITLE = 'Interval timer for circuit workouts';

/**
 * Show one section of the home view and mark its tab as the current page.
 *
 * @param {HTMLElement} element The home view.
 * @param {string} name Section to show.
 * @returns {void}
 */
const showSection = (element, name) => {
  element.querySelectorAll('[data-section]').forEach((section) => {
    section.hidden = section.dataset.section !== name;
  });
  element.querySelectorAll('[data-tab]').forEach((tab) => {
    if (tab.dataset.tab === name) {
      tab.setAttribute('aria-current', 'page');
    } else {
      tab.removeAttribute('aria-current');
    }
  });
};

/**
 * The statistics section of the home view.
 *
 * @param {string} [selector] Selector of the home view.
 * @returns {import('./router.js').View} The view.
 */
export const stats = (selector = '[data-view="home"]') => {
  const element = document.querySelector(selector);

  return {
    element,
    title: () => `Statistics – ${TITLE}`,
    show: () => showSection(element, 'stats')
  };
};

/**
 * The presets and the saved workouts with their Start and Edit links.
 *
 * @param {string} [selector] Selector of the home view.
 * @returns {import('./router.js').View} The view.
 */
export const init = (selector = '[data-view="home"]') => {
  const element = document.querySelector(selector);
  const list = element.querySelector('[data-workouts]');
  const presetList = element.querySelector('[data-presets]');
  const createFirst = element.querySelector('[data-create-first]');
  const template = document.querySelector('[data-template="workout"]');

  // Sound and the screen lock both need a tap, and the Start link is that tap.
  element.addEventListener('click', (event) => {
    if (!event.target.closest('[data-start]')) return;

    sound.unlock();
    wakeLock.acquire();
  });

  /**
   * @param {import('./workout.js').Workout} workout Workout to show.
   * @returns {HTMLElement} The list item.
   */
  const createItem = (workout) => {
    const item = template.content.cloneNode(true).querySelector('.workout');
    const start = item.querySelector('[data-start]');
    const edit = item.querySelector('[data-edit]');

    item.dataset.colour = workout.colour;
    item.querySelector('[data-name]').textContent = workout.name;
    item.querySelector('[data-meta]').textContent = describe(workout);

    edit.href = `#/edit/${workout.id}`;

    // A preset cannot be changed, so the same link makes a copy of it to edit.
    if (presets.getPreset(workout.id)) {
      edit.querySelector('[data-icon]').dataset.icon = 'copy';
      edit.lastChild.textContent = 'Copy';
      edit.setAttribute('aria-label', `Copy ${workout.name}`);
    } else {
      edit.setAttribute('aria-label', `Edit ${workout.name}`);
    }

    if (workout.exercises.length === 0) {
      start.remove();
    } else {
      start.href = `#/timer/${workout.id}`;
      start.setAttribute('aria-label', `Start ${workout.name}`);
    }

    return item;
  };

  const render = () => {
    const workouts = library.getWorkouts();

    presetList.replaceChildren(...presets.getPresets().map(createItem));
    list.replaceChildren(...workouts.map(createItem));
    createFirst.hidden = workouts.length > 0;
    showSection(element, 'workouts');
  };

  return {
    element,
    title: () => TITLE,
    show: render
  };
};
