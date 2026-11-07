import * as dialog from './dialog.js';
import { t } from './i18n.js';
import * as library from './library.js';
import { describe } from './phase.js';
import * as preferences from './preferences.js';
import * as router from './router.js';
import * as sound from './sound.js';
import { format, MS } from './time.js';
import { buildCues, buildTimeline, locate, stepTarget } from './timeline.js';
import * as transport from './transport.js';
import * as wakeLock from './wake-lock.js';
import { buildSteps } from './workout.js';

/** Modifier class of the timer for every phase, which sets the colour of the phase. */
const PHASES = ['prepare', 'work', 'rest', 'round', 'done'];

/**
 * The running timer. Its position comes from `Date.now()`, not from counted ticks: it keeps how much active time has
 * passed and when it last resumed, so it stays exact when ticks are late or the page was hidden, and it keeps the time
 * that iOS spends with the page suspended, during which `performance.now()` stands still.
 *
 * The screen runs the workout that the history state names. It starts afresh, unless the state asks to resume or the
 * page has just loaded on it, as after a reload, when it picks the saved progress up. After a reload it waits for a
 * tap, which the browser needs before it plays sound.
 *
 * @param {string} [selector] Selector of the timer screen.
 * @param {object} [options] Timings in milliseconds.
 * @param {number} [options.tickInterval] Interval between redraws of the clock.
 * @param {number} [options.lookahead] How far ahead cues are handed to the audio clock.
 * @param {number} [options.stale] A cue later than this is skipped rather than played out of time.
 * @param {number} [options.restartAfter] Previous restarts the current step when it is further in than this.
 * @param {number} [options.pulseDuration] Length of the pulse of the clock on every second of the countdown.
 * @returns {void}
 */
export const init = (
  selector = '[data-screen="timer"]',
  { tickInterval = 200, lookahead = 1000, stale = 500, restartAfter = 2000, pulseDuration = 320 } = {}
) => {
  const screen = /** @type {HTMLElement | null} */ (document.querySelector(selector));

  if (!screen) return;

  const part = (name) => /** @type {HTMLElement} */ (screen.querySelector(`[data-part="${name}"]`));
  const action = (name) => /** @type {HTMLButtonElement} */ (screen.querySelector(`[data-action="${name}"]`));
  const fill = part('fill');
  const focus = part('focus');
  const name = part('name');
  const note = part('note');
  const clock = part('clock');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /** @type {import('./workout.js').Workout} */
  let workout;
  /** @type {import('./workout.js').Step[]} */
  let steps = [];
  /** @type {import('./timeline.js').Timeline} */
  let timeline;
  /** @type {import('./timeline.js').Cue[]} */
  let cues = [];
  let nextCue = 0;
  let playback = transport.create();
  let timerId = 0;
  let frameId = 0;
  /** The step on screen, to redraw only what changed. */
  let shown = null;
  /** Whether Next took the workout to its end, which does not count as a finished workout. */
  let skipped = false;
  let recorded = false;
  /** Seconds at the end of a step that tick, from the preferences when the workout starts. */
  let countdown = 0;
  let shownSeconds = -1;
  /** Name of the phase in view, which the label shows again when a paused workout runs on. */
  let phaseTitle = '';

  const isRunning = () => transport.isRunning(playback);
  const elapsed = () => transport.elapsed(playback, Date.now());

  const seekCues = (at) => {
    const index = cues.findIndex((cue) => cue.at >= at);

    nextCue = index === -1 ? cues.length : index;
  };

  const scheduleCues = (at) => {
    // The cues wait until the audio runs, so that the first ones are not lost while it starts up.
    if (preferences.get().sound && !sound.isRunning()) return;

    while (nextCue < cues.length && cues[nextCue].at <= at + lookahead) {
      const cue = cues[nextCue];

      nextCue += 1;

      if (cue.at >= at - stale) sound.play(cue.kind, Math.max(0, cue.at - at));
    }
  };

  const showSound = () => {
    const on = preferences.get().sound;

    sound.setMuted(!on);
    action('sound').setAttribute('aria-pressed', String(on));
    action('sound').dataset.icon = on ? 'volume' : 'volume-x';
  };

  const showControls = () => {
    const finished = locate(timeline, elapsed()).finished;
    const paused = !isRunning() && !finished;
    const toggle = action('toggle');

    // A paused workout says so in place of its phase and dims its clock, which shows from across the room.
    screen.classList.toggle('timer--paused', paused);
    part('phase').textContent = paused ? t('timer.paused') : phaseTitle;

    toggle.hidden = finished;
    action('previous').hidden = finished;
    action('next').hidden = finished;
    action('finish').hidden = !finished;
    // A finished workout has no time left to count and no cues left to mute.
    part('remaining').parentElement.hidden = finished;
    action('sound').hidden = finished;
    toggle.dataset.icon = isRunning() ? 'pause' : 'play';
    toggle.setAttribute('aria-label', t(isRunning() ? 'timer.pause' : 'timer.resume'));
    action('end').setAttribute('aria-label', t(finished ? 'timer.close' : 'timer.end'));
  };

  /**
   * Draw everything that belongs to the step rather than to the second.
   *
   * @param {number} index Step in view.
   * @param {boolean} finished Whether the workout is over.
   * @returns {string} What a screen reader announces.
   */
  const showStep = (index, finished) => {
    const display = describe({
      steps,
      names: workout.exercises.map(({ name: exercise }) => exercise),
      rounds: workout.rounds,
      workout: workout.name,
      index,
      finished
    });

    PHASES.forEach((phase) => screen.classList.toggle(`timer--${phase}`, phase === display.phase));
    phaseTitle = display.title;
    part('phase').textContent = phaseTitle;
    name.textContent = display.name;
    note.textContent = display.note;
    // During an exercise its name leads; otherwise the note says what the name is.
    focus.replaceChildren(...(display.phase === 'work' || finished ? [name, note] : [note, name]));
    part('round').textContent = display.round;
    part('round').hidden = !display.round;
    part('next').hidden = !display.next;
    part('next-label').textContent = display.next?.label ?? '';
    part('next-text').textContent = display.next?.text ?? '';
    part('next-time').textContent = display.next?.time ?? '';

    return [display.title, display.name].filter(Boolean).join(', ');
  };

  const record = () => {
    if (recorded || skipped) return;

    recorded = true;
    library.recordCompletion(workout);
    library.clearSession();
  };

  const paintProgress = (at) => {
    const { index, remaining, finished } = locate(timeline, at);
    const progress = finished ? 1 : 1 - remaining / (steps[index].duration * MS);

    fill.style.setProperty('--progress', `${(progress * 100).toFixed(2)}%`);
  };

  /** Move the bar on every frame while running, so that it glides between the ticks of the clock. */
  const follow = () => {
    paintProgress(elapsed());
    frameId = requestAnimationFrame(follow);
  };

  /**
   * Show the seconds left, and pulse the clock with every tick of the countdown at the end of a step.
   *
   * @param {number} seconds Seconds to show.
   * @param {boolean} still Whether the clock must not pulse, because the step has just changed or the workout ended.
   * @returns {void}
   */
  const showClock = (seconds, still) => {
    if (seconds === shownSeconds) return;

    clock.textContent = format(seconds);
    shownSeconds = seconds;

    if (still || !isRunning() || seconds < 1 || seconds > countdown || reducedMotion.matches) return;

    // The easing comes from the design tokens; a browser without the Web Animations API just shows no pulse.
    const easing = getComputedStyle(screen).getPropertyValue('--ease-out').trim() || 'ease-out';

    clock.animate?.([{ scale: 1 }, { scale: 1.08 }, { scale: 1 }], { duration: pulseDuration, easing });
  };

  const render = (at) => {
    const { index, remaining, finished } = locate(timeline, at);
    const changed = !shown || shown.index !== index || shown.finished !== finished;

    if (changed) {
      const announcement = showStep(index, finished);

      if (shown) part('announce').textContent = announcement;
      if (finished) record();

      shown = { index, finished };
      showControls();
    }

    showClock(finished ? timeline.total / MS : Math.ceil(remaining / MS), changed || finished);
    part('remaining').textContent = format(finished ? 0 : Math.ceil((timeline.total - at) / MS));
    paintProgress(at);
  };

  /** Keep the position of an unfinished workout, to resume it later or after iOS ended the app in the background. */
  const rememberProgress = () => {
    if (!workout) return;

    const at = elapsed();

    if (at > 0 && at < timeline.total) {
      library.saveSession({ id: workout.id, elapsed: at, savedAt: Date.now() });
    } else {
      library.clearSession();
    }
  };

  /** Stop the clock without touching the cues, so that the finish chime can ring out. */
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
      showControls();
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
    showControls();
  };

  const pause = () => {
    halt();
    sound.cancel();
    seekCues(elapsed());
    showControls();
  };

  const jump = (delta) => {
    const target = stepTarget(timeline, elapsed(), delta, restartAfter);

    if (target === null) return;
    if (target >= timeline.total) skipped = true;

    playback = transport.jumpTo(playback, target, Date.now());
    sound.cancel();
    seekCues(target);

    if (isRunning()) {
      tick();
    } else {
      render(target);
      showControls();
    }
  };

  const leave = () => router.go('#workouts', null, { replace: true });

  const end = async () => {
    if (locate(timeline, elapsed()).finished) {
      leave();
      return;
    }

    const wasRunning = isRunning();

    if (wasRunning) pause();

    const confirmed = await dialog.ask({
      title: t('timer.endTitle'),
      text: t('timer.endText'),
      confirmLabel: t('timer.endConfirm')
    });

    // Going back while the dialog was open has already left the screen.
    if (screen.hidden) return;

    if (confirmed) {
      // A clock back at the start makes leaving forget the progress instead of keeping it for a resume.
      playback = transport.create();
      leave();
    } else if (wasRunning) {
      start();
    }
  };

  const toggle = () => {
    if (isRunning()) {
      pause();
      part('announce').textContent = t('timer.paused');
    } else {
      start();
      part('announce').textContent = phaseTitle;
    }
  };

  const handlers = {
    toggle,
    previous: () => jump(-1),
    next: () => jump(1),
    end,
    finish: leave,
    sound: () => {
      preferences.update({ sound: !preferences.get().sound });
      showSound();
      // Cues that fell due while the sound was off must not be dropped from a long lookahead.
      seekCues(elapsed());
    }
  };

  screen.addEventListener('click', async (event) => {
    const button = /** @type {HTMLElement | null} */ (/** @type {Element} */ (event.target).closest('[data-action]'));

    await handlers[button?.dataset.action]?.();
  });

  // The tap that opens the timer is the gesture that lets the browser play sound, so the audio is unlocked by it.
  document.addEventListener(
    'click',
    (event) => {
      if (/** @type {Element} */ (event.target).closest(`a[href="#${screen.id}"]`)) sound.unlock();
    },
    { capture: true }
  );

  // A focused control keeps its own keys: Space presses a button and the arrows move a caret.
  document.addEventListener('keydown', (event) => {
    const target = /** @type {Element} */ (event.target);
    const blocked = event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

    if (
      screen.hidden ||
      blocked ||
      target.closest('input, select, textarea') ||
      document.querySelector('dialog[open]')
    ) {
      return;
    }

    const shortcuts = { ArrowRight: () => jump(1), ArrowLeft: () => jump(-1) };

    if (!target.closest('a, button')) shortcuts[' '] = toggle;

    const run = shortcuts[event.key];

    if (!run || locate(timeline, elapsed()).finished) return;

    event.preventDefault();
    run();
  });

  document.addEventListener('visibilitychange', () => {
    if (screen.hidden) return;

    if (document.visibilityState === 'hidden') {
      rememberProgress();
    } else if (isRunning()) {
      // iOS may hold the audio clock while the page is away, so the cues are scheduled again from the real time.
      sound.cancel();
      seekCues(elapsed());
      tick();
    }
  });

  window.addEventListener('pagehide', () => {
    if (!screen.hidden) rememberProgress();
  });

  screen.addEventListener('screen:show', (event) => {
    const { workout: id, resume, initial } = /** @type {CustomEvent} */ (event).detail ?? {};
    const found = id ? library.getWorkout(id) : undefined;

    if (!found || found.exercises.length === 0) {
      // The router is still showing this screen, so the way home waits until it is done.
      queueMicrotask(leave);
      return;
    }

    const { volume, playback: silentMode, keepAwake } = preferences.get();
    const saved = library.loadSession();

    workout = found;
    steps = buildSteps(workout);
    timeline = buildTimeline(steps);
    countdown = preferences.get().countdown;
    cues = buildCues(timeline, countdown);
    sound.setVolume(volume);
    sound.setPlayback(silentMode);
    void wakeLock.setEnabled(keepAwake);

    const resumeAt =
      (resume || initial) && saved?.id === workout.id && saved.elapsed < timeline.total ? saved.elapsed : 0;

    playback = transport.create(resumeAt);
    seekCues(resumeAt);
    shown = null;
    shownSeconds = -1;
    skipped = false;
    recorded = false;
    part('title').textContent = workout.name;
    showSound();
    render(resumeAt);

    // After a reload the browser keeps the sound locked until a tap, so the workout waits for Play; a tap that opened
    // the timer, also on the card that resumes it, has unlocked the sound already.
    if (!initial && sound.isReady()) {
      start();
    } else {
      showControls();
    }
  });

  screen.addEventListener('screen:hide', () => {
    rememberProgress();
    halt();
    sound.cancel();
  });
};
