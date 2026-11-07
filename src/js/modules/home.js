import * as dialog from './dialog.js';
import { count, t } from './i18n.js';
import * as library from './library.js';
import * as ring from './ring.js';
import { format } from './time.js';
import { duplicateWorkout, totalSeconds } from './workout.js';

/** Stroke width of the ring of a workout tile, in the units of its 100 × 100 box. */
const RING_WIDTH = 3.8;

/**
 * The workouts of the home screen: a tile for each with its ring, total time and size, which starts it, and a menu
 * to edit, duplicate or delete it, followed by a tile that creates a new workout. The list is drawn whenever the
 * screen shows.
 *
 * @param {string} [selector] Selector of the home screen.
 * @returns {void}
 */
export const init = (selector = '[data-screen="workouts"]') => {
  const screen = /** @type {HTMLElement | null} */ (document.querySelector(selector));
  const list = screen?.querySelector('[data-list="workouts"]');
  const tally = screen?.querySelector('[data-count="workouts"]');
  const template = /** @type {HTMLTemplateElement | null} */ (document.querySelector('[data-template="workout"]'));

  if (!screen || !list || !tally || !template) return;

  const creator = list.querySelector('[data-tile="create"]');

  /**
   * @param {import('./workout.js').Workout} workout Workout to show.
   * @returns {DocumentFragment} Its tile.
   */
  const tile = (workout) => {
    const fragment = /** @type {DocumentFragment} */ (template.content.cloneNode(true));
    const part = (name) => /** @type {HTMLElement} */ (fragment.querySelector(`[data-part="${name}"]`));
    const time = format(totalSeconds(workout));
    const start = /** @type {HTMLAnchorElement} */ (part('start'));

    start.dataset.workout = workout.id;
    start.setAttribute('aria-label', t('home.startNamed', { name: workout.name, time }));
    part('name').textContent = workout.name;
    part('time').textContent = time;
    part('exercises').textContent = count('count.exercises', workout.exercises.length);
    part('rounds').textContent = count('count.rounds', workout.rounds);
    part('actions').setAttribute('aria-label', t('home.actions', { name: workout.name }));
    part('edit').dataset.workout = workout.id;
    part('duplicate').dataset.workout = workout.id;
    part('delete').dataset.workout = workout.id;
    ring.draw(
      fragment.querySelector('[data-part="ring"]'),
      ring.layout(ring.segments(workout), RING_WIDTH),
      RING_WIDTH
    );

    return fragment;
  };

  const show = () => {
    const workouts = library.getWorkouts();

    list.replaceChildren(...workouts.map(tile), creator);
    tally.textContent = String(workouts.length);
  };

  const remove = async (workout) => {
    const confirmed = await dialog.ask({
      title: t('home.deleteTitle', { name: workout.name }),
      text: t('home.deleteText'),
      confirmLabel: t('home.delete')
    });

    if (confirmed) library.deleteWorkout(workout.id);
  };

  list.addEventListener('click', async (event) => {
    const button = /** @type {Element} */ (event.target).closest('button[data-action]');
    const workout = button && library.getWorkout(/** @type {HTMLElement} */ (button).dataset.workout);

    if (!workout) return;

    if (button.dataset.action === 'duplicate') library.saveWorkout(duplicateWorkout(workout), { after: workout.id });
    if (button.dataset.action === 'delete') await remove(workout);

    show();
  });

  screen.addEventListener('screen:show', show);
};
