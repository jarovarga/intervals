import * as library from './library.js';
import { count } from './plural.js';
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
 * The list of workouts with their Start and Edit links.
 *
 * @param {string} [selector] Selector of the home view.
 * @returns {import('./router.js').View} The view.
 */
export const init = (selector = '[data-view="home"]') => {
  const element = document.querySelector(selector);
  const list = element.querySelector('[data-workouts]');
  const empty = element.querySelector('[data-empty]');
  const template = document.querySelector('[data-template="workout"]');

  // Sound and the screen lock both need a tap, and the Start link is that tap.
  list.addEventListener('click', (event) => {
    if (!event.target.closest('[data-start]')) return;

    sound.unlock();
    wakeLock.acquire();
  });

  const render = () => {
    const workouts = library.getWorkouts();

    list.replaceChildren(
      ...workouts.map((workout) => {
        const item = template.content.cloneNode(true).querySelector('.workout');
        const start = item.querySelector('[data-start]');
        const edit = item.querySelector('[data-edit]');

        item.dataset.colour = workout.colour;
        item.querySelector('[data-name]').textContent = workout.name;
        item.querySelector('[data-meta]').textContent = describe(workout);
        edit.href = `#/edit/${workout.id}`;
        edit.setAttribute('aria-label', `Edit ${workout.name}`);

        if (workout.exercises.length === 0) {
          start.remove();
        } else {
          start.href = `#/timer/${workout.id}`;
          start.setAttribute('aria-label', `Start ${workout.name}`);
        }

        return item;
      })
    );
    empty.hidden = workouts.length > 0;
  };

  return {
    element,
    title: () => 'Interval timer for circuit & tabata workouts',
    show: render
  };
};
