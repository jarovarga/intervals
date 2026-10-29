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
  const sections = /** @type {NodeListOf<HTMLElement>} */ (element.querySelectorAll('[data-section]'));
  const tabs = /** @type {NodeListOf<HTMLElement>} */ (element.querySelectorAll('[data-tab]'));

  sections.forEach((section) => {
    section.hidden = section.dataset.section !== name;
  });
  tabs.forEach((tab) => {
    if (tab.dataset.tab === name) {
      tab.setAttribute('aria-current', 'page');
    } else {
      tab.removeAttribute('aria-current');
    }
  });
};

/**
 * The statistics section of the intro screen. It gives the router the screen to show: its element, its page title and
 * what to do when it opens.
 *
 * @param {string} [selector] Selector of the intro screen.
 * @param {object} [options] Settings.
 * @param {string} [options.title] Title of the app, which ends every page title.
 */
export const stats = (selector = '[data-screen="intro"]', { title } = {}) => {
  const element = /** @type {HTMLElement} */ (document.querySelector(selector));

  return {
    element,
    title: () => `Statistics – ${title}`,
    show: () => showSection(element, 'stats')
  };
};

/**
 * The presets and the saved workouts with their Start and Edit links. It gives the router the screen to show: its
 * element, its page title and what to do when it opens.
 *
 * @param {string} [selector] Selector of the intro screen.
 * @param {object} [options] Settings.
 * @param {string} [options.title] Title of the app, which is the page title of this screen.
 */
export const init = (selector = '[data-screen="intro"]', { title } = {}) => {
  const element = /** @type {HTMLElement} */ (document.querySelector(selector));
  const list = element.querySelector('[data-workouts="custom"]');
  const presetList = element.querySelector('[data-workouts="presets"]');
  const createFirst = /** @type {HTMLElement} */ (element.querySelector('[data-create="first"]'));
  const resume = /** @type {HTMLElement} */ (element.querySelector('[data-notice="resume"]'));
  const template = /** @type {HTMLTemplateElement} */ (document.querySelector('[data-template="workout"]'));

  // Sound and the screen lock both need a tap, and the Start link is that tap.
  element.addEventListener('click', (event) => {
    const target = /** @type {Element} */ (event.target);

    if (!target.closest('[data-start="workout"]')) return;

    sound.unlock();
    void wakeLock.acquire();
  });

  /**
   * @param {import('./workout.js').Workout} workout Workout to show.
   * @returns {HTMLElement} The list item.
   */
  const createItem = (workout) => {
    const item = /** @type {HTMLElement} */ (document.importNode(template.content, true).querySelector('.workout'));
    const start = /** @type {HTMLAnchorElement} */ (item.querySelector('[data-start="workout"]'));
    const edit = /** @type {HTMLAnchorElement} */ (item.querySelector('[data-edit="workout"]'));

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

  /** Offer to continue the workout that was left unfinished, for instance when iOS ended the app in the background. */
  const renderResume = () => {
    const session = library.loadSession();
    const workout = session && (library.getWorkout(session.id) ?? presets.getPreset(session.id));

    resume.hidden = !workout || workout.exercises.length === 0;

    if (resume.hidden) return;

    const link = /** @type {HTMLAnchorElement} */ (resume.querySelector('[data-resume="workout"]'));

    resume.querySelector('[data-name="resume"]').textContent = workout.name;
    link.href = `#/timer/${workout.id}/resume`;
  };

  resume.querySelector('[data-action="discard"]').addEventListener('click', () => {
    library.clearSession();
    resume.hidden = true;
  });

  const render = () => {
    const workouts = library.getWorkouts();

    presetList.replaceChildren(...presets.getPresets().map(createItem));
    list.replaceChildren(...workouts.map(createItem));
    createFirst.hidden = workouts.length > 0;
    renderResume();
    showSection(element, 'workouts');
  };

  return {
    element,
    title: () => title,
    show: render
  };
};
