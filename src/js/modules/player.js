import * as dialog from './dialog.js';
import * as library from './library.js';
import { describeNext, PHASE_LABELS } from './phase.js';
import * as presets from './presets.js';
import * as router from './router.js';
import * as sound from './sound.js';
import { formatClock, formatTotal, MS } from './time.js';
import { buildCues, buildTimeline, locate, stepTarget } from './timeline.js';
import * as transport from './transport.js';
import * as wakeLock from './wake-lock.js';
import { buildSteps } from './workout.js';

/**
 * The running timer. Position comes from Date.now(), not from counting ticks: the timer stores how much active time
 * has passed and when it last resumed, so it stays exact when ticks are late or the page was hidden. The wall clock is
 * a deliberate choice: changing the system time moves a running timer, but performance.now() stands still while iOS
 * suspends the page, which would make the timer lose the time it ran in the background. It gives the router the
 * screen to show: its element, its page title and what to do when it opens and closes.
 *
 * @param {string} [selector] Selector of the timer screen.
 * @param {object} [options] Settings; the timings are in milliseconds.
 * @param {string} [options.title] Title of the app, which ends the page title.
 * @param {number} [options.tickInterval] Interval between redraws.
 * @param {number} [options.lookahead] How far ahead signals are handed to the audio clock.
 * @param {number} [options.stale] A signal later than this is skipped rather than played out of time, for example after the page was hidden.
 * @param {number} [options.restartAfter] Previous restarts the current step when it is further in than this.
 * @param {number} [options.pulseDuration] Duration of the clock pulse in the final countdown.
 * @param {number} [options.segmentDuration] Duration of one finished segment lighting up.
 * @param {number} [options.segmentStagger] Delay between the segments lighting up.
 */
export const init = (
  selector = '[data-screen="timer"]',
  {
    title,
    tickInterval = 200,
    lookahead = 1000,
    stale = 500,
    restartAfter = 2000,
    pulseDuration = 320,
    segmentDuration = 220,
    segmentStagger = 90
  } = {}
) => {
  const element = /** @type {HTMLElement} */ (document.querySelector(selector));
  const part = (name, context = 'timer') =>
    /** @type {HTMLElement} */ (element.querySelector(`[data-${name}="${context}"]`));
  const heading = element.querySelector('[data-title="timer"]');
  const clock = part('clock');
  const label = part('label');
  const segments = part('segments');
  const progressBar = part('progress');
  const toggle = /** @type {HTMLButtonElement} */ (element.querySelector('[data-action="toggle"]'));
  const soundButton = /** @type {HTMLButtonElement} */ (element.querySelector('[data-action="sound"]'));
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
  /** Seconds at the end of a step that get a tick and a clock pulse; the settings may change it between workouts. */
  let countdown = 0;
  /** How far the workout has got and whether the clock runs; every change goes through the transport functions. */
  let playback = transport.create();
  let timerId = 0;
  let frameId = 0;
  /** What is on screen, to redraw only what changed. */
  let shown = null;
  let shownSeconds = -1;
  let shownTotal = -1;

  const isRunning = () => transport.isRunning(playback);
  const elapsed = () => transport.elapsed(playback, Date.now());

  /**
   * @param {string} name CSS custom property that holds an easing curve.
   * @param {string} fallback Easing to use when the property is missing.
   * @returns {string} The easing.
   */
  const easing = (name, fallback) => getComputedStyle(element).getPropertyValue(name).trim() || fallback;

  const animate = (target, keyframes, options) => {
    if (reducedMotion.matches) return;

    // A browser without the Web Animations API has no `animate`, and the redraw then simply has no motion.
    target.animate?.(keyframes, options);
  };

  const seekCues = (at) => {
    const index = cues.findIndex((cue) => cue.at >= at);

    nextCue = index === -1 ? cues.length : index;
  };

  const scheduleCues = (at) => {
    // Keep the cues until the audio runs, so that the first signals are not lost while it starts up.
    if (library.isSoundOn() && !sound.isRunning()) return;

    while (nextCue < cues.length && cues[nextCue].at <= at + lookahead) {
      const cue = cues[nextCue];

      nextCue += 1;

      if (cue.at >= at - stale) sound.play(cue.kind, Math.max(0, cue.at - at));
    }
  };

  const renderControls = () => {
    const finished = locate(timeline, elapsed()).finished;
    const paused = !isRunning() && !finished;

    element.toggleAttribute('data-paused', paused);
    part('status').hidden = !paused;
    toggle.setAttribute('aria-label', finished ? 'Restart' : paused ? 'Resume' : 'Pause');
    toggle.dataset.icon = isRunning() ? 'pause' : 'play';
  };

  const renderSound = () => {
    const on = library.isSoundOn();

    sound.setMuted(!on);
    soundButton.setAttribute('aria-pressed', String(on));
    soundButton.dataset.icon = on ? 'volume-on' : 'volume-off';
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
    const next = describeNext({ steps, names, index, finished, total: timeline.total });
    const name = document.createElement('span');

    name.classList.add('timer__name');
    name.textContent = next.then;
    const band = /** @type {HTMLElement} */ (element.querySelector('.timer__next'));

    band.dataset.phase = next.phase;
    part('label', 'next').textContent = next.heading;
    part('title', 'next').textContent = next.title;
    part('sub', 'next').replaceChildren(next.sub, name);
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
    let focus = `${done} of ${total} done`;

    if (!finished && step.type === 'work') {
      focus = workout.exercises[step.exercise].name;
    } else if (!finished && step.type === 'rest') {
      focus = '';
    }

    element.dataset.phase = phase;
    label.textContent = PHASE_LABELS[phase];
    part('title', 'focus').textContent = focus;
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

    return finished ? 'Workout complete' : [PHASE_LABELS[phase], focus].filter(Boolean).join(', ');
  };

  /** Light the segments up one after another when the workout ends. A change of step itself is not animated. */
  const animateFinish = () => {
    Array.from(segments.children).forEach((segment, position) => {
      animate(segment, [{ opacity: 0.2 }, { opacity: 1 }], {
        duration: segmentDuration,
        delay: position * segmentStagger,
        fill: 'backwards'
      });
    });
  };

  /** Move the progress bar to where the current step stands at the given time. */
  const paintProgress = (at) => {
    const { index, remaining, finished } = locate(timeline, at);
    const progress = finished ? 1 : 1 - remaining / (steps[index].duration * MS);

    progressBar.style.setProperty('--progress', String(progress));
  };

  /** Redraw the bar on every frame while running, so that it moves smoothly between the clock's ticks. */
  const follow = () => {
    paintProgress(elapsed());
    frameId = requestAnimationFrame(follow);
  };

  /** Draw a step that has just begun, and announce it unless it is the first one drawn. */
  const showStep = (index, finished) => {
    const announcement = renderStep(index, finished);

    if (shown) {
      if (finished) animateFinish();

      part('announce').textContent = announcement;
    }

    shown = { index, finished };
    shownSeconds = -1;
  };

  /** Show the seconds left in the step, and pulse the clock during the final countdown. */
  const showClock = (seconds, stepChanged) => {
    if (seconds === shownSeconds) return;

    clock.textContent = formatClock(seconds);

    if (!stepChanged && isRunning() && seconds >= 1 && seconds <= countdown) {
      animate(clock, [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], {
        duration: pulseDuration,
        easing: easing('--ease-out', 'ease-out')
      });
    }

    shownSeconds = seconds;
  };

  /** Show the time left in the whole workout. */
  const showTotal = (left) => {
    if (left === shownTotal) return;

    part('remaining').textContent = formatTotal(left);
    shownTotal = left;
  };

  const render = (at) => {
    const { index, remaining, finished } = locate(timeline, at);
    const changed = !shown || shown.index !== index || shown.finished !== finished;

    if (changed) showStep(index, finished);

    showClock(finished ? 0 : Math.ceil(remaining / MS), changed);
    showTotal(finished ? 0 : Math.ceil((timeline.total - at) / MS));
    paintProgress(at);

    if (changed) renderControls();
  };

  /** @returns {number | null} Where the reloaded workout stood, or null when this is not the one that was running. */
  const savedProgress = () => {
    const session = library.loadSession();

    return session?.id === workout.id && session.elapsed < timeline.total ? session.elapsed : null;
  };

  /** Keep the position of an unfinished workout, because a reload loses everything held in memory. */
  const rememberProgress = () => {
    if (element.hidden) return;

    const at = elapsed();

    if (at > 0 && at < timeline.total) {
      library.saveSession({ id: workout.id, elapsed: at, savedAt: Date.now() });
    } else {
      library.clearSession();
    }
  };

  /** Stop the clock without touching the signals, so that a finish chime can ring out. */
  const halt = () => {
    clearInterval(timerId);
    cancelAnimationFrame(frameId);
    playback = transport.pause(playback, Date.now());
    void wakeLock.release();
  };

  const tick = () => {
    const at = elapsed();

    scheduleCues(at);

    if (at >= timeline.total) {
      playback = transport.create(timeline.total);
      halt();
      render(timeline.total);
      renderControls();
      return;
    }

    render(at);
  };

  const start = () => {
    sound.unlock();
    void wakeLock.acquire();
    playback = transport.start(playback, Date.now());
    clearInterval(timerId);
    timerId = setInterval(tick, tickInterval);
    cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(follow);
    tick();
    renderControls();
  };

  const pause = () => {
    halt();
    sound.cancel();
    seekCues(elapsed());
    renderControls();
  };

  const jumpTo = (at) => {
    playback = transport.jumpTo(playback, at, Date.now());
    sound.cancel();
    seekCues(at);

    if (isRunning()) {
      tick();
    } else {
      render(at);
      renderControls();
    }
  };

  const go = (delta) => {
    const target = stepTarget(timeline, elapsed(), delta, restartAfter);

    if (target !== null) jumpTo(target);
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

    // The user may have left this screen by going back while the dialog was open.
    if (element.hidden) return;

    if (confirmed) {
      router.navigate('#/');
    } else if (wasRunning) {
      start();
    }
  };

  element.addEventListener('click', (event) => {
    const target = /** @type {Element} */ (event.target);
    const button = /** @type {HTMLElement | null} */ (target.closest('[data-action]'));

    switch (button?.dataset.action) {
      case 'toggle':
        if (locate(timeline, elapsed()).finished) {
          playback = transport.create();
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
        end().catch((error) => console.warn('The workout could not be ended.', error));
        break;
      case 'sound':
        library.setSoundOn(!library.isSoundOn());
        renderSound();
        // Signals that fell due while the sound was off must not be dropped from a long lookahead.
        seekCues(elapsed());
        break;
      default:
    }
  });

  // iOS may end the app while it is in the background, so the position is kept whenever the page is hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      rememberProgress();
    } else if (isRunning()) {
      // The signals handed to the audio clock far ahead can be out of step if iOS held the clock while the page was
      // away, so they are scheduled again from the time the workout has really reached.
      sound.cancel();
      seekCues(elapsed());
      tick();
    }
  });

  window.addEventListener('pagehide', rememberProgress);

  return {
    element,
    title: () => `${workout?.name ?? 'Workout'} – ${title}`,
    // A page that has just loaded on this screen, as after a reload, and the Resume link pick a workout up where it
    // stopped; opening it from the list always starts it afresh.
    show: ({ id, mode }, { initial }) => {
      const found = library.getWorkout(id) ?? presets.getPreset(id);

      if (!found || found.exercises.length === 0) return false;

      workout = found;
      steps = buildSteps(workout);
      timeline = buildTimeline(steps);
      countdown = library.getSettings().countdown;
      cues = buildCues(timeline, countdown);
      const resumeAt = initial || mode === 'resume' ? savedProgress() : null;

      playback = transport.create(resumeAt ?? 0);
      seekCues(elapsed());
      shown = null;
      heading.textContent = workout.name;
      renderSound();
      render(elapsed());

      // Without a tap, the browser would keep the signals silent, so a reloaded workout waits for the Resume button.
      if (resumeAt === null && sound.isReady()) {
        start();
      } else {
        renderControls();
      }

      return true;
    },
    leave: () => {
      halt();
      sound.cancel();
      library.clearSession();
    }
  };
};
