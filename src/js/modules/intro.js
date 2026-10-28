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

/**
 * Show one section of the intro screen and mark its tab as the current page.
 *
 * @param {HTMLElement} element The intro screen.
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
 * The statistics section of the intro screen.
 *
 * @param {string} [selector] Selector of the intro screen.
 * @param {object} options Settings.
 * @param {string} options.appTitle Title of the app, which ends every page title.
 * @returns {import('./router.js').Screen} The screen.
 */
export const stats = (selector = '[data-screen="intro"]', { appTitle } = {}) => {
  const element = document.querySelector(selector);

  return {
    element,
    title: () => `Statistics – ${appTitle}`,
    show: () => showSection(element, 'stats')
  };
};

/**
 * The presets and the saved workouts with their Start and Edit links.
 *
 * @param {string} [selector] Selector of the intro screen.
 * @param {object} options Settings.
 * @param {string} options.appTitle Title of the app, which is the page title of this screen.
 * @returns {import('./router.js').Screen} The screen.
 */
export const init = (selector = '[data-screen="intro"]', { appTitle } = {}) => {
  const element = document.querySelector(selector);
  const list = element.querySelector('[data-workouts="custom"]');
  const presetList = element.querySelector('[data-workouts="presets"]');
  const createFirst = element.querySelector('[data-create="first"]');
  const template = document.querySelector('[data-template="workout"]');

  // Sound and the screen lock both need a tap, and the Start link is that tap.
  element.addEventListener('click', (event) => {
    if (!event.target.closest('[data-start="workout"]')) return;

    sound.unlock();
    wakeLock.acquire();
  });

  /**
   * @param {import('./workout.js').Workout} workout Workout to show.
   * @returns {HTMLElement} The list item.
   */
  const createItem = (workout) => {
    const item = template.content.cloneNode(true).querySelector('.workout');
    const start = item.querySelector('[data-start="workout"]');
    const edit = item.querySelector('[data-edit="workout"]');

    item.dataset.colour = workout.colour;
    item.querySelector('[data-name="workout"]').textContent = workout.name;
    item.querySelector('[data-meta="workout"]').textContent = describe(workout);

    edit.href = `#/edit/${workout.id}`;

    // A preset cannot be changed, so the same link makes a copy of it to edit.
    if (presets.getPreset(workout.id)) {
      edit.dataset.icon = 'copy';
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
    title: () => appTitle,
    show: render
  };
};
