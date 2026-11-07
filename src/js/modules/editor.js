import * as dialog from './dialog.js';
import { t } from './i18n.js';
import * as library from './library.js';
import * as presets from './presets.js';
import * as router from './router.js';
import { format, formatField, parse } from './time.js';
import { MAX_ROUNDS, createBlankWorkout, createExercise, totalSeconds } from './workout.js';

/** Value of the preset choice that keeps the workout as it is. */
const CUSTOM = 'custom';

/** Fields that hold one time of the workout, by `data-field`, with the property they set. */
const TIME_FIELDS = { 'prepare': 'prepare', 'rest': 'rest', 'round-rest': 'roundRest' };

/**
 * Check a draft before it is saved.
 *
 * @param {import('./workout.js').Workout} draft Workout being edited.
 * @returns {{ message: string, field: string, exercise?: string } | null} The first problem: its message, the field to focus and the exercise it is in.
 */
export const findProblem = (draft) => {
  if (!draft.name.trim()) return { message: 'editor.enterName', field: 'name' };
  if (draft.exercises.length === 0) return { message: 'editor.addOne', field: 'add' };

  const blank = draft.exercises.find(({ name }) => !name.trim());

  return blank ? { message: 'editor.nameEvery', field: 'exercise-name', exercise: blank.id } : null;
};

/**
 * Take over the exercises, timing and intensity of a preset. A new workout takes its name too; an existing one keeps
 * its own.
 *
 * @param {import('./workout.js').Workout} draft Workout being edited.
 * @param {import('./workout.js').Workout} preset A workout built from the preset.
 * @param {boolean} isNew Whether the draft is a new workout.
 * @returns {import('./workout.js').Workout} The draft with the preset applied, under its own identifier.
 */
export const applyPreset = (draft, preset, isNew) => ({
  ...preset,
  id: draft.id,
  name: isNew ? preset.name : draft.name
});

/**
 * @param {import('./workout.js').Workout} draft Workout being edited.
 * @returns {import('./workout.js').Workout} The workout to store, with names trimmed.
 */
const finished = (draft) => ({
  ...draft,
  name: draft.name.trim(),
  exercises: draft.exercises.map((exercise) => ({ ...exercise, name: exercise.name.trim() }))
});

/**
 * The editor of one workout. Changes stay in a draft until Save, so that Cancel leaves the workout as it was. The
 * screen edits the workout that the history state names, or a new one without.
 *
 * @param {string} [selector] Selector of the editor screen.
 * @returns {void}
 */
export const init = (selector = '[data-screen="editor"]') => {
  const screen = /** @type {HTMLElement | null} */ (document.querySelector(selector));
  const form = /** @type {HTMLFormElement | null} */ (screen?.querySelector('[data-form="editor"]'));
  const template = /** @type {HTMLTemplateElement | null} */ (document.querySelector('[data-template="exercise"]'));

  if (!screen || !form || !template) return;

  const field = (name) => /** @type {HTMLInputElement} */ (form.querySelector(`[data-field="${name}"]`));
  const action = (name) => /** @type {HTMLButtonElement} */ (form.querySelector(`[data-action="${name}"]`));
  const list = form.querySelector('[data-list="exercises"]');
  const heading = form.querySelector('[data-title="editor"]');
  const status = form.querySelector('[data-status="editor"]');
  const total = form.querySelector('[data-total="editor"]');
  const tally = form.querySelector('[data-count="exercises"]');

  /** @type {import('./workout.js').Workout} */
  let draft = createBlankWorkout();
  let isNew = true;

  const say = (key = '') => {
    status.textContent = key ? t(key) : '';
  };

  const focus = (selector) => /** @type {HTMLElement | null} */ (form.querySelector(selector))?.focus();

  const showSummary = () => {
    total.textContent = format(totalSeconds(draft));
    tally.textContent = String(draft.exercises.length);
    action('fewer-rounds').disabled = draft.rounds <= 1;
    action('more-rounds').disabled = draft.rounds >= MAX_ROUNDS;
  };

  /**
   * @param {import('./workout.js').Exercise} exercise Exercise of the row.
   * @param {number} index Its position.
   * @returns {HTMLElement} The row with its fields filled and its controls named.
   */
  const row = (exercise, index) => {
    const item = /** @type {HTMLElement} */ (document.importNode(template.content, true).firstElementChild);
    const name = exercise.name.trim() || t('editor.exerciseName', { n: index + 1 });
    const control = (selector) => /** @type {HTMLInputElement} */ (item.querySelector(selector));

    item.dataset.exercise = exercise.id;
    control('[data-part="number"]').textContent = String(index + 1);
    control('[data-field="exercise-name"]').value = exercise.name;
    control('[data-field="exercise-name"]').setAttribute('aria-label', t('editor.exerciseName', { n: index + 1 }));
    control('[data-field="exercise-time"]').value = formatField(exercise.time);
    control('[data-field="exercise-time"]').setAttribute('aria-label', t('editor.exerciseTime', { name }));
    control('[data-action="up"]').setAttribute('aria-label', t('editor.moveUp', { name }));
    control('[data-action="up"]').disabled = index === 0;
    control('[data-action="down"]').setAttribute('aria-label', t('editor.moveDown', { name }));
    control('[data-action="down"]').disabled = index === draft.exercises.length - 1;
    control('[data-action="remove"]').setAttribute('aria-label', t('editor.remove', { name }));

    return item;
  };

  /**
   * Draw the exercises again and put focus back where the user was working.
   *
   * @param {string} [selector] Selector, inside the form, of the control to focus afterwards.
   * @returns {void}
   */
  const showExercises = (selector) => {
    list.replaceChildren(...draft.exercises.map(row));
    showSummary();

    if (selector) focus(selector);
  };

  const showAll = () => {
    field('name').value = draft.name;
    field('intensity').value = draft.intensity;
    field('prepare').value = formatField(draft.prepare);
    field('rest').value = formatField(draft.rest);
    field('rounds').value = String(draft.rounds);
    field('round-rest').value = formatField(draft.roundRest);
    showExercises();
  };

  const fillPresets = () => {
    field('preset').replaceChildren(
      new Option(t('editor.custom'), CUSTOM),
      ...presets.PRESETS.map(({ id, name }) => new Option(name, id))
    );
  };

  const indexOf = (target) => {
    const item = /** @type {HTMLElement} */ (target.closest('[data-exercise]'));

    return draft.exercises.findIndex(({ id }) => id === item.dataset.exercise);
  };

  /**
   * Store a typed time, or show the previous one again when the text is not a time.
   *
   * @param {HTMLInputElement} input Field that changed.
   * @param {number} previous Time before the change, in seconds.
   * @param {boolean} allowZero Whether the field accepts 0.
   * @returns {number} The time to keep.
   */
  const readTime = (input, previous, allowZero) => {
    const parsed = parse(input.value, { allowZero });
    const seconds = parsed ?? previous;

    input.value = formatField(seconds);
    say(parsed === null ? 'editor.timeNotRecognised' : '');

    return seconds;
  };

  const setRounds = (value) => {
    draft.rounds = Number.isInteger(value) ? Math.min(MAX_ROUNDS, Math.max(1, value)) : draft.rounds;
    field('rounds').value = String(draft.rounds);
    showSummary();
  };

  const leave = () => router.go('#workouts', null, { replace: true });

  const problem = () => {
    const found = findProblem(draft);

    if (!found) {
      say();
      return false;
    }

    say(found.message);
    focus(
      found.exercise
        ? `[data-exercise="${found.exercise}"] [data-field="${found.field}"]`
        : `[data-field="${found.field}"], [data-action="${found.field}"]`
    );

    return true;
  };

  const remove = async () => {
    const confirmed = await dialog.ask({
      title: t('editor.deleteTitle', { name: draft.name.trim() || t('workout.workout') }),
      text: t('editor.deleteText'),
      confirmLabel: t('editor.deleteConfirm')
    });

    if (!confirmed) return;

    library.deleteWorkout(draft.id);
    leave();
  };

  const move = (index, step) => {
    const target = index + step;
    const exercises = draft.exercises.toSpliced(index, 1);

    draft.exercises = exercises.toSpliced(target, 0, draft.exercises[index]);

    // Focus stays on the button that was used, unless the row reached the end and that button is now disabled.
    const atEdge = step < 0 ? target === 0 : target === draft.exercises.length - 1;
    const button = step < 0 === atEdge ? 'down' : 'up';

    showExercises(`[data-exercise="${draft.exercises[target].id}"] [data-action="${button}"]`);
  };

  const removeExercise = (index) => {
    draft.exercises = draft.exercises.toSpliced(index, 1);

    const neighbour = draft.exercises[Math.min(index, draft.exercises.length - 1)];

    showExercises(neighbour ? `[data-exercise="${neighbour.id}"] [data-field="exercise-name"]` : '[data-action="add"]');
  };

  const handlers = {
    'cancel': leave,
    'add': () => {
      const exercise = createExercise(t('workout.exerciseNumbered', { n: draft.exercises.length + 1 }));

      draft.exercises = [...draft.exercises, exercise];
      showExercises(`[data-exercise="${exercise.id}"] [data-field="exercise-name"]`);
    },
    'fewer-rounds': () => setRounds(draft.rounds - 1),
    'more-rounds': () => setRounds(draft.rounds + 1),
    'delete': remove,
    'up': (button) => move(indexOf(button), -1),
    'down': (button) => move(indexOf(button), 1),
    'remove': (button) => removeExercise(indexOf(button))
  };

  form.addEventListener('click', async (event) => {
    const button = /** @type {HTMLElement | null} */ (/** @type {Element} */ (event.target).closest('[data-action]'));

    await handlers[button?.dataset.action]?.(button);
  });

  form.addEventListener('input', (event) => {
    const target = /** @type {HTMLInputElement} */ (event.target);

    if (target.dataset.field === 'name') draft.name = target.value;
    if (target.dataset.field === 'exercise-name') draft.exercises[indexOf(target)].name = target.value;
  });

  form.addEventListener('change', (event) => {
    const target = /** @type {HTMLInputElement} */ (event.target);
    const key = target.dataset.field;

    if (key === 'preset' && target.value !== CUSTOM) {
      draft = applyPreset(draft, presets.createFromPreset(target.value), isNew);
      say();
      showAll();
    } else if (key === 'intensity') {
      draft.intensity = target.value;
    } else if (key in TIME_FIELDS) {
      draft[TIME_FIELDS[key]] = readTime(target, draft[TIME_FIELDS[key]], true);
      showSummary();
    } else if (key === 'rounds') {
      setRounds(Number.parseInt(target.value, 10));
    } else if (key === 'exercise-time') {
      const exercise = draft.exercises[indexOf(target)];

      exercise.time = readTime(target, exercise.time, false);
      showSummary();
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (problem()) return;

    // Without storage the form stays open with the draft, instead of leaving with a workout that would be lost.
    if (!library.saveWorkout(finished(draft))) {
      say('settings.notSaved');
      return;
    }

    leave();
  });

  screen.addEventListener('screen:show', (event) => {
    const id = /** @type {CustomEvent} */ (event).detail?.workout;
    const existing = id ? library.getWorkout(id) : undefined;

    isNew = !existing;
    draft = structuredClone(existing ?? createBlankWorkout());
    heading.textContent = t(isNew ? 'editor.titleNew' : 'editor.titleEdit');
    action('delete').hidden = isNew;
    fillPresets();
    field('preset').value = CUSTOM;
    say();
    showAll();
  });
};
