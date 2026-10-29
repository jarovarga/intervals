import * as dialog from './dialog.js';
import * as library from './library.js';
import * as presets from './presets.js';
import * as router from './router.js';
import { formatField, formatTotal, parse } from './time.js';
import { MAX_ROUNDS, createBlankWorkout, createExercise, totalSeconds } from './workout.js';

/** Fields that hold one time of the workout, by `data-field` value. */
const TIME_FIELDS = { 'prepare': 'prepare', 'rest': 'rest', 'round-rest': 'roundRest' };

/**
 * Check a draft before it is saved.
 *
 * @param {import('./workout.js').Workout} draft Workout being edited.
 * @returns {{ message: string, focus: string } | null} The first problem and the selector of the control to focus.
 */
const findProblem = (draft) => {
  if (!draft.name.trim()) return { message: 'Enter a workout name.', focus: '[data-field="name"]' };
  if (draft.exercises.length === 0) return { message: 'Add at least one exercise.', focus: '[data-action="add"]' };

  const blank = draft.exercises.find((exercise) => !exercise.name.trim());

  return blank ? { message: 'Give every exercise a name.', focus: `[data-id="${blank.id}"] input[type="text"]` } : null;
};

/**
 * The form that edits one workout. Changes live in a draft until Save, so Cancel leaves the workout untouched. It
 * gives the router the screen to show: its element, its page title and what to do when it opens.
 *
 * @param {string} [selector] Selector of the editor screen.
 * @param {object} [options] Settings.
 * @param {string} [options.title] Title of the app, which ends the page title.
 */
export const init = (selector = '[data-screen="editor"]', { title } = {}) => {
  const element = /** @type {HTMLElement} */ (document.querySelector(selector));
  const form = /** @type {HTMLFormElement} */ (element.querySelector('[data-form="editor"]'));
  const heading = element.querySelector('[data-title="editor"]');
  const message = /** @type {HTMLElement} */ (element.querySelector('[data-error="editor"]'));
  const list = element.querySelector('[data-editor="exercises"]');
  const template = /** @type {HTMLTemplateElement} */ (document.querySelector('[data-template="exercise"]'));
  const fieldIn = (root, name) => /** @type {HTMLInputElement} */ (root.querySelector(`[data-field="${name}"]`));
  const field = (name) => fieldIn(form, name);
  const action = (name) => /** @type {HTMLButtonElement} */ (form.querySelector(`[data-action="${name}"]`));
  const focusOn = (selector) => {
    const control = /** @type {HTMLElement | null} */ (form.querySelector(selector));

    control?.focus();
  };

  /** @type {import('./workout.js').Workout} */
  let draft;
  let isNew = false;

  const say = (text = '') => {
    message.textContent = text;
    message.hidden = text === '';
  };

  const renderSummary = () => {
    form.querySelector('[data-count="exercises"]').textContent = String(draft.exercises.length);
    form.querySelector('[data-total="editor"]').textContent = formatTotal(totalSeconds(draft));
    action('fewer-rounds').disabled = draft.rounds <= 1;
    action('more-rounds').disabled = draft.rounds >= MAX_ROUNDS;
  };

  /**
   * Name an exercise row for assistive technology and disable the move buttons that have nowhere to go.
   *
   * @param {HTMLElement} row Row to update.
   * @param {number} index Position of the row.
   * @returns {void}
   */
  const labelRow = (row, index) => {
    const exercise = draft.exercises[index];
    const name = exercise.name.trim() || `exercise ${index + 1}`;
    const up = /** @type {HTMLButtonElement} */ (row.querySelector('[data-action="up"]'));
    const down = /** @type {HTMLButtonElement} */ (row.querySelector('[data-action="down"]'));

    row.dataset.id = exercise.id;
    row.querySelector('[data-number="exercise"]').textContent = String(index + 1);
    row.querySelector('[data-label="name"]').textContent = `Exercise ${index + 1} name`;
    row.querySelector('[data-label="time"]').textContent = `, ${name}`;
    up.setAttribute('aria-label', `Move up: ${name}`);
    up.disabled = index === 0;
    down.setAttribute('aria-label', `Move down: ${name}`);
    down.disabled = index === draft.exercises.length - 1;
    row.querySelector('[data-action="remove"]').setAttribute('aria-label', `Remove: ${name}`);
  };

  /**
   * Redraw the exercise list and put focus back where the user was working.
   *
   * @param {string} [focus] Selector, inside the form, of the control to focus afterwards.
   * @returns {void}
   */
  const renderExercises = (focus) => {
    list.replaceChildren(
      ...draft.exercises.map((exercise, index) => {
        const row = /** @type {HTMLElement} */ (document.importNode(template.content, true).querySelector('.exercise'));

        fieldIn(row, 'exercise-name').value = exercise.name;
        fieldIn(row, 'exercise-time').value = formatField(exercise.time);
        labelRow(row, index);

        return row;
      })
    );
    renderSummary();

    if (focus) focusOn(focus);
  };

  const renderAll = () => {
    field('name').value = draft.name;

    // A colour without a swatch falls back to the first one, so that the form and the draft agree.
    const swatches = /** @type {HTMLInputElement[]} */ ([...form.querySelectorAll('input[name="colour"]')]);
    const swatch = swatches.find((input) => input.value === draft.colour) ?? swatches[0];

    draft.colour = swatch.value;
    swatch.checked = true;

    field('prepare').value = formatField(draft.prepare);
    field('rest').value = formatField(draft.rest);
    field('round-rest').value = formatField(draft.roundRest);
    field('rounds').value = String(draft.rounds);
    renderExercises();
  };

  /**
   * Store a typed time, or restore the previous one when the text is not a time.
   *
   * @param {HTMLInputElement} input Field that changed.
   * @param {number} previous Time before the change, in seconds.
   * @param {boolean} allowZero Whether the field accepts 0.
   * @param {(seconds: number) => void} apply Stores the new time in the draft.
   * @returns {void}
   */
  const commitTime = (input, previous, allowZero, apply) => {
    const seconds = parse(input.value, { allowZero });

    apply(seconds ?? previous);
    input.value = formatField(seconds ?? previous);
    say(seconds === null ? 'That time was not recognised, so the previous time was kept.' : '');
    renderSummary();
  };

  const setRounds = (value) => {
    draft.rounds = Math.min(MAX_ROUNDS, Math.max(1, Number.isNaN(value) ? draft.rounds : value));
    field('rounds').value = String(draft.rounds);
    renderSummary();
  };

  /**
   * @param {HTMLElement} target Control inside an exercise row.
   * @returns {{ row: HTMLElement, index: number }} The row and the position of its exercise.
   */
  const rowOf = (target) => {
    const row = /** @type {HTMLElement} */ (target.closest('.exercise'));

    return { row, index: draft.exercises.findIndex((exercise) => exercise.id === row.dataset.id) };
  };

  form.addEventListener('input', (event) => {
    const target = /** @type {HTMLInputElement} */ (event.target);

    if (target === field('name')) {
      draft.name = target.value;
    } else if (target.dataset.field === 'exercise-name') {
      const { row, index } = rowOf(target);

      draft.exercises[index].name = target.value;
      labelRow(row, index);
    }
  });

  form.addEventListener('change', (event) => {
    const target = /** @type {HTMLInputElement} */ (event.target);
    const key = target.dataset.field;

    if (target.name === 'colour') {
      draft.colour = target.value;
    } else if (key in TIME_FIELDS) {
      const property = TIME_FIELDS[key];

      commitTime(target, draft[property], true, (seconds) => {
        draft[property] = seconds;
      });
    } else if (key === 'rounds') {
      setRounds(Number.parseInt(target.value, 10));
    } else if (key === 'exercise-time') {
      const { index } = rowOf(target);
      const exercise = draft.exercises[index];

      commitTime(target, exercise.time, false, (seconds) => {
        exercise.time = seconds;
      });
    }
  });

  const move = (index, step) => {
    const target = index + step;
    const [exercise] = draft.exercises.splice(index, 1);

    draft.exercises.splice(target, 0, exercise);

    // Keep focus on the button that was used, unless the row has reached the end and that button is now disabled.
    const atEdge = step < 0 ? target === 0 : target === draft.exercises.length - 1;
    const button = step < 0 === atEdge ? 'down' : 'up';

    renderExercises(`[data-id="${exercise.id}"] [data-action="${button}"]`);
  };

  const remove = (index) => {
    draft.exercises.splice(index, 1);

    const neighbour = draft.exercises[Math.min(index, draft.exercises.length - 1)];

    renderExercises(neighbour ? `[data-id="${neighbour.id}"] [data-field="exercise-name"]` : '[data-action="add"]');
  };

  const deleteWorkout = async () => {
    const confirmed = await dialog.ask({
      title: 'Delete workout?',
      text: `“${draft.name.trim() || 'This workout'}” will be deleted for good.`,
      confirmLabel: 'Delete'
    });

    if (!confirmed) return;

    library.deleteWorkout(draft.id);
    router.navigate('#/');
  };

  form.addEventListener('click', (event) => {
    const target = /** @type {Element} */ (event.target);
    const button = /** @type {HTMLElement | null} */ (target.closest('[data-action]'));

    if (!button) return;

    const name = button.dataset.action;

    if (name === 'add') {
      const exercise = createExercise();

      draft.exercises.push(exercise);
      renderExercises(`[data-id="${exercise.id}"] [data-field="exercise-name"]`);
    } else if (name === 'fewer-rounds' || name === 'more-rounds') {
      setRounds(draft.rounds + (name === 'more-rounds' ? 1 : -1));
    } else if (name === 'delete') {
      deleteWorkout().catch((error) => console.warn('The workout could not be deleted.', error));
    } else {
      const { index } = rowOf(button);

      if (name === 'up') move(index, -1);
      if (name === 'down') move(index, 1);
      if (name === 'remove') remove(index);
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const problem = findProblem(draft);

    if (problem) {
      say(problem.message);
      focusOn(problem.focus);
      return;
    }

    draft.name = draft.name.trim();
    draft.exercises.forEach((exercise) => {
      exercise.name = exercise.name.trim();
    });
    library.saveWorkout(draft);
    router.navigate('#/');
  });

  return {
    element,
    title: () => `${isNew ? 'New' : 'Edit'} workout – ${title}`,
    show: ({ id }) => {
      const existing = library.getWorkout(id);
      // A preset stays as it is; editing it starts a new workout from a copy.
      const copy = existing ? undefined : presets.copyPreset(id);

      if (id !== 'new' && !existing && !copy) return false;

      isNew = !existing;
      draft = structuredClone(existing ?? copy ?? createBlankWorkout());
      heading.textContent = isNew ? 'New workout' : 'Edit workout';
      action('delete').hidden = isNew;
      say();
      renderAll();

      return true;
    }
  };
};
