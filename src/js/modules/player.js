import * as dialog from './dialog.js';
import * as library from './library.js';
import { count } from './plural.js';
import * as router from './router.js';
import * as sound from './sound.js';
import { formatClock, formatField, formatTotal } from './time.js';
import { buildCues, buildTimeline, locate } from './timeline.js';
import * as wakeLock from './wake-lock.js';
import { buildSteps } from './workout.js';

const MS = 1000;
const TICK_MS = 200;
/** How far ahead signals are handed to the audio clock. */
const LOOKAHEAD_MS = 1000;
/** A signal later than this is skipped rather than played out of time, for example after the page was hidden. */
const STALE_MS = 500;
const COUNTDOWN_SECONDS = 3;
/** Previous restarts the current step when it is further in than this. */
const RESTART_MS = 2000;
const WIPE_MS = 320;
const FLASH_MS = 360;
const SETTLE_MS = 900;
const PULSE_MS = 320;
const SEGMENT_MS = 220;
const SEGMENT_STAGGER_MS = 90;

const PHASE_LABELS = {
  prepare: 'Get ready',
  work: 'Work',
  rest: 'Rest',
  round: 'Cooldown',
  done: 'Done'
};

/**
 * The running timer. Position comes from Date.now(), not from counting ticks: the timer stores how much active time
 * has passed and when it last resumed, so it stays exact when ticks are late or the page was hidden.
 *
 * @param {string} [selector] Selector of the timer view.
 * @returns {import('./router.js').View} The view.
 */
export const init = (selector = '[data-view="timer"]') => {
  const element = document.querySelector(selector);
  const part = (name) => element.querySelector(`[data-${name}]`);
  const heading = part('heading');
  const clock = part('clock');
  const label = part('label');
  const wipe = part('wipe');
  const flash = part('flash');
  const segments = part('segments');
  const toggle = element.querySelector('[data-action="toggle"]');
  const soundButton = element.querySelector('[data-action="sound"]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /** @type {import('./workout.js').Workout} */
  let workout;
  /** @type {import('./workout.js').Step[]} */
  let steps;
  /** @type {import('./timeline.js').Timeline} */
  let timeline;
  /** @type {import('./timeline.js').Cue[]} */
  let cues;
  let nextCue = 0;
  /** Active milliseconds before the last resume. */
  let elapsedBefore = 0;
  /** Date.now() of the last resume, or null while paused or finished. */
  let resumedAt = null;
  let timerId = 0;
  let frameId = 0;
  /** What is on screen, to redraw only what changed. */
  let shown = null;
  let shownSeconds = -1;
  let shownTotal = -1;

  const isRunning = () => resumedAt !== null;
  const elapsed = () => elapsedBefore + (isRunning() ? Date.now() - resumedAt : 0);

  /**
   * @param {string} name CSS custom property that holds an easing curve.
   * @param {string} fallback Easing to use when the property is missing.
   * @returns {string} The easing.
   */
  const easing = (name, fallback) => getComputedStyle(element).getPropertyValue(name).trim() || fallback;

  const animate = (target, keyframes, options) => {
    if (reducedMotion.matches || typeof target.animate !== 'function') return;

    target.animate(keyframes, options);
  };

  const seekCues = (at) => {
    const index = cues.findIndex((cue) => cue.at >= at);

    nextCue = index === -1 ? cues.length : index;
  };

  const scheduleCues = (at) => {
    // Keep the cues until the audio runs, so that the first signals are not lost while it starts up.
    if (library.isSoundOn() && !sound.isRunning()) return;

    while (nextCue < cues.length && cues[nextCue].at <= at + LOOKAHEAD_MS) {
      const cue = cues[nextCue];

      nextCue += 1;

      if (cue.at >= at - STALE_MS) sound.play(cue.kind, Math.max(0, cue.at - at));
    }
  };

  const renderControls = () => {
    const finished = locate(timeline, elapsed()).finished;
    const paused = !isRunning() && !finished;

    element.toggleAttribute('data-paused', paused);
    part('paused').hidden = !paused;
    toggle.setAttribute('aria-label', finished ? 'Restart' : paused ? 'Resume' : 'Pause');
    part('toggle-icon').dataset.icon = isRunning() ? 'pause' : 'play';
  };

  const renderSound = () => {
    const on = library.isSoundOn();

    sound.setMuted(!on);
    soundButton.setAttribute('aria-pressed', String(on));
    part('sound-icon').dataset.icon = on ? 'volume-on' : 'volume-off';
  };

  /**
   * Write what the "up next" band says about the step after this one.
   *
   * @param {number} index Current step.
   * @param {boolean} finished Whether the workout is over.
   * @returns {void}
   */
  const renderNext = (index, finished) => {
    const names = workout.exercises.map((exercise) => exercise.name);
    const after = steps[index + 1];
    const band = element.querySelector('.timer__next');
    let phase = 'done';
    let title = 'End of workout';
    let sub = 'Final interval';
    let then = '';
    let heading = 'Up next';

    if (finished) {
      phase = 'work';
      heading = 'Workout complete';
      title = 'Well done';
      sub = `${count(names.length, 'exercise', 'exercises')} · ${formatTotal(timeline.total / MS)}`;
    } else if (after?.type === 'work') {
      phase = 'work';
      title = names[after.exercise];
      sub = `Exercise ${after.exercise + 1} of ${names.length}`;
    } else if (after) {
      // A rest is counted; only a cooldown says which exercise starts the next round.
      const work =
        after.type === 'round'
          ? steps.find((step, position) => position > index + 1 && step.type === 'work')
          : undefined;

      phase = after.type;
      title = `${PHASE_LABELS[after.type]} ${formatField(after.duration)}`;
      sub = '';

      if (after.type === 'rest') {
        // A rest follows exercise number `after.exercise`, so it is that rest of the round.
        sub = `Rest ${after.exercise} of ${names.length - 1}`;
      } else if (work) {
        sub = 'Then ';
        then = names[work.exercise];
      }
    }

    band.dataset.phase = phase;
    part('next-label').textContent = heading;
    part('next-title').textContent = title;
    const name = document.createElement('span');

    name.classList.add('timer__name');
    name.textContent = then;
    part('next-sub').replaceChildren(sub, name);
  };

  /**
   * Redraw everything that belongs to the current step rather than the current second.
   *
   * @param {number} index Current step.
   * @param {boolean} finished Whether the workout is over.
   * @returns {string} What a screen reader should announce.
   */
  const renderStep = (index, finished) => {
    const step = steps[index];
    const total = workout.exercises.length;
    const phase = finished ? 'done' : step.type;
    const done = finished ? total : step.exercise;
    const focus =
      !finished && step.type === 'work' ? workout.exercises[step.exercise].name : `${done} of ${total} done`;

    element.dataset.phase = phase;
    label.textContent = PHASE_LABELS[phase];
    part('focus').textContent = focus;
    part('focus').classList.toggle('timer__focus--name', !finished && step.type === 'work');
    part('round').textContent = `Round ${finished ? workout.rounds : step.round + 1}/${workout.rounds}`;
    segments.setAttribute('aria-label', `${done} of ${total} exercises done`);
    segments.replaceChildren(
      ...workout.exercises.map((exercise, position) => {
        const segment = document.createElement('span');

        segment.classList.add('timer__segment');

        if (position < done) {
          segment.classList.add('timer__segment--done');
        } else if (!finished && step.type === 'work' && position === step.exercise) {
          segment.classList.add('timer__segment--current');
        }

        return segment;
      })
    );
    renderNext(index, finished);

    return finished ? 'Workout complete' : `${PHASE_LABELS[phase]}, ${focus}`;
  };

  /**
   * Mark a change of step: the old colour drains away, the panel flashes and the label settles. The wipe, flash and
   * settle are skipped for visitors who ask for reduced motion.
   *
   * @param {string} previous Phase that just ended.
   * @param {boolean} finished Whether the workout is now over.
   * @returns {void}
   */
  const animateStep = (previous, finished) => {
    const curve = easing('--ease-in-out', 'ease-in-out');

    wipe.dataset.phase = previous;
    animate(wipe, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }], {
      duration: WIPE_MS,
      easing: curve
    });
    animate(flash, [{ opacity: 0 }, { opacity: 0.35 }, { opacity: 0 }], { duration: FLASH_MS });
    animate(
      label,
      [
        { transform: 'scale(1.15)', opacity: 0.4 },
        { transform: 'scale(0.98)', opacity: 1, offset: 0.65 },
        { transform: 'scale(1)', opacity: 1 }
      ],
      { duration: SETTLE_MS, easing: easing('--ease-out', 'ease-out') }
    );

    if (finished) {
      Array.from(segments.children).forEach((segment, position) => {
        animate(segment, [{ opacity: 0.2 }, { opacity: 1 }], {
          duration: SEGMENT_MS,
          delay: position * SEGMENT_STAGGER_MS,
          fill: 'backwards'
        });
      });
    }
  };

  /** Move the progress bar to where the current step stands at the given time. */
  const paintProgress = (at) => {
    const { index, remaining, finished } = locate(timeline, at);
    const progress = finished ? 1 : 1 - remaining / (steps[index].duration * MS);

    part('progress').style.setProperty('--progress', String(progress));
  };

  /** Redraw the bar on every frame while running, so that it moves smoothly between the clock's ticks. */
  const follow = () => {
    paintProgress(elapsed());
    frameId = requestAnimationFrame(follow);
  };

  const render = (at) => {
    const { index, remaining, finished } = locate(timeline, at);
    const changed = !shown || shown.index !== index || shown.finished !== finished;

    if (changed) {
      const announcement = renderStep(index, finished);

      if (shown) {
        animateStep(shown.finished ? 'done' : steps[shown.index].type, finished);
        part('announce').textContent = announcement;
      }

      shown = { index, finished };
      shownSeconds = -1;
    }

    const seconds = finished ? 0 : Math.ceil(remaining / MS);

    if (seconds !== shownSeconds) {
      clock.textContent = formatClock(seconds);

      if (!changed && isRunning() && seconds >= 1 && seconds <= COUNTDOWN_SECONDS) {
        animate(clock, [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], {
          duration: PULSE_MS,
          easing: easing('--ease-out', 'ease-out')
        });
      }

      shownSeconds = seconds;
    }

    const left = finished ? 0 : Math.ceil((timeline.total - at) / MS);

    if (left !== shownTotal) {
      part('remaining').textContent = formatTotal(left);
      shownTotal = left;
    }

    paintProgress(at);

    if (changed) renderControls();
  };

  /** Stop the clock without touching the signals, so that a finish chime can ring out. */
  const halt = () => {
    clearInterval(timerId);
    cancelAnimationFrame(frameId);
    elapsedBefore = elapsed();
    resumedAt = null;
    wakeLock.release();
  };

  const tick = () => {
    const at = elapsed();

    scheduleCues(at);

    if (at >= timeline.total) {
      elapsedBefore = timeline.total;
      halt();
      render(timeline.total);
      renderControls();
      return;
    }

    render(at);
  };

  const start = () => {
    sound.unlock();
    wakeLock.acquire();
    resumedAt = Date.now();
    clearInterval(timerId);
    timerId = setInterval(tick, TICK_MS);
    cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(follow);
    tick();
    renderControls();
  };

  const pause = () => {
    halt();
    sound.cancel();
    seekCues(elapsedBefore);
    renderControls();
  };

  const jumpTo = (at) => {
    elapsedBefore = at;
    sound.cancel();
    seekCues(at);

    if (isRunning()) {
      resumedAt = Date.now();
      tick();
    } else {
      render(at);
      renderControls();
    }
  };

  const go = (delta) => {
    const { index, finished } = locate(timeline, elapsed());
    const last = steps.length - 1;

    if (finished && delta > 0) return;

    if (!finished && delta > 0 && index === last) {
      jumpTo(timeline.total);
      return;
    }

    // Going back restarts the current step first, unless it has only just begun.
    const restart = !finished && delta < 0 && elapsed() - timeline.starts[index] > RESTART_MS;
    const target = finished ? last : Math.min(last, Math.max(0, index + (restart ? 0 : delta)));

    jumpTo(timeline.starts[target]);
  };

  const end = async () => {
    if (locate(timeline, elapsed()).finished) {
      router.navigate('#/');
      return;
    }

    const wasRunning = isRunning();

    if (wasRunning) pause();

    const confirmed = await dialog.ask({
      title: 'End workout?',
      text: 'Your progress in this workout will be lost.',
      confirmLabel: 'End workout'
    });

    // The user may have left this view by going back while the dialog was open.
    if (element.hidden) return;

    if (confirmed) {
      router.navigate('#/');
    } else if (wasRunning) {
      start();
    }
  };

  element.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');

    switch (button?.dataset.action) {
      case 'toggle':
        if (locate(timeline, elapsed()).finished) {
          elapsedBefore = 0;
          seekCues(0);
          shown = null;
          start();
        } else if (isRunning()) {
          pause();
        } else {
          start();
        }
        break;
      case 'previous':
        go(-1);
        break;
      case 'next':
        go(1);
        break;
      case 'end':
        end();
        break;
      case 'sound':
        library.setSoundOn(!library.isSoundOn());
        renderSound();
        break;
      default:
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isRunning()) tick();
  });

  return {
    element,
    title: () => `${workout?.name ?? 'Workout'} – Intervals`,
    show: ([id]) => {
      const found = library.getWorkout(id);

      if (!found || found.exercises.length === 0) return false;

      workout = found;
      steps = buildSteps(workout);
      timeline = buildTimeline(steps);
      cues = buildCues(timeline);
      elapsedBefore = 0;
      resumedAt = null;
      nextCue = 0;
      shown = null;
      heading.textContent = workout.name;
      renderSound();
      render(0);

      // Without a tap, the browser would keep the signals silent, so wait for the Resume button.
      if (sound.isReady()) {
        start();
      } else {
        renderControls();
      }

      return true;
    },
    leave: () => {
      halt();
      sound.cancel();
    }
  };
};
