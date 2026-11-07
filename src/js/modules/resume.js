import { t } from './i18n.js';
import * as library from './library.js';
import { buildTimeline, locate } from './timeline.js';
import { buildSteps } from './workout.js';

/**
 * The card of the home screen that picks an unfinished workout up where it stopped, or discards it. It shows while
 * the saved progress is less than an hour old and its workout still exists, and is drawn whenever the screen shows.
 *
 * @param {string} [selector] Selector of the home screen.
 * @returns {void}
 */
export const init = (selector = '[data-screen="workouts"]') => {
  const screen = /** @type {HTMLElement | null} */ (document.querySelector(selector));
  const card = /** @type {HTMLElement | null} */ (screen?.querySelector('[data-notice="resume"]'));

  if (!screen || !card) return;

  const part = (name) => /** @type {HTMLElement} */ (card.querySelector(`[data-part="${name}"]`));

  const show = () => {
    const progress = library.loadSession();
    const workout = progress && library.getWorkout(progress.id);
    const steps = workout ? buildSteps(workout) : [];
    const timeline = buildTimeline(steps);
    const { index, finished } = locate(timeline, progress?.elapsed ?? 0);

    card.hidden = !workout || steps.length === 0 || finished;

    if (card.hidden) return;

    const step = steps[index];

    part('resume').dataset.workout = workout.id;
    part('resume').setAttribute('aria-label', t('resume.continue', { name: workout.name }));
    part('name').textContent = workout.name;
    part('meta').textContent = [
      t('timer.exerciseOf', { n: step.exercise + 1, total: workout.exercises.length }),
      t('timer.round', { n: step.round + 1, total: workout.rounds })
    ].join(' · ');
  };

  card.querySelector('[data-action="discard-resume"]').addEventListener('click', () => {
    library.clearSession();
    show();
  });

  screen.addEventListener('screen:show', show);
};
