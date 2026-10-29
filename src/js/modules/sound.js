import { MS } from './time.js';

/** Notes of each signal: pitch in Hz, start offset and length in seconds. */
const CUES = {
  tick: [{ frequency: 660, offset: 0, length: 0.12 }],
  work: [{ frequency: 988, offset: 0, length: 0.5 }],
  rest: [{ frequency: 494, offset: 0, length: 0.35 }],
  round: [
    { frequency: 440, offset: 0, length: 0.2 },
    { frequency: 440, offset: 0.3, length: 0.2 }
  ],
  done: [
    { frequency: 523, offset: 0, length: 0.18 },
    { frequency: 659, offset: 0.22, length: 0.18 },
    { frequency: 784, offset: 0.44, length: 0.5 }
  ]
};

const PEAK_GAIN = 0.4;
const ATTACK = 0.005;
const SILENCE = 0.0001;

/** @type {AudioContext | null} */
let context = null;
let muted = false;
let unlocked = false;
/** @type {Set<GainNode>} */
const playing = new Set();

const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;

/**
 * Create and resume the audio context. Call it from a tap: browsers only allow sound after a user gesture, and iOS
 * Safari also needs a buffer played inside that gesture.
 *
 * @returns {void}
 */
export const unlock = () => {
  if (!AudioContextClass) return;

  context ??= new AudioContextClass();
  unlocked = true;

  if (context.state !== 'running') {
    context.resume().catch((error) => console.warn('The audio could not be resumed.', error));
  }

  const source = context.createBufferSource();

  source.buffer = context.createBuffer(1, 1, context.sampleRate);
  source.connect(context.destination);
  source.start();
};

/**
 * @returns {boolean} True while the audio context is running, so a signal scheduled now will sound.
 */
export const isRunning = () => context?.state === 'running';

/**
 * @returns {boolean} True once a tap has unlocked the audio, or when the browser has no audio to unlock.
 */
export const isReady = () => !AudioContextClass || unlocked;

/**
 * Resume the audio context when the page comes back. iOS suspends it when the page is hidden or interrupted.
 *
 * @returns {void}
 */
export const init = () => {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && unlocked && !isRunning()) {
      context.resume().catch((error) => console.warn('The audio could not be resumed.', error));
    }
  });
};

/**
 * Silence every signal that has been scheduled but has not finished.
 *
 * @returns {void}
 */
export const cancel = () => {
  playing.forEach((gain) => gain.disconnect());
  playing.clear();
};

/**
 * @param {boolean} value Whether to silence the signals.
 * @returns {void}
 */
export const setMuted = (value) => {
  muted = value;

  if (muted) cancel();
};

/**
 * Schedule a signal on the audio clock, which keeps its timing steady however busy the page is.
 *
 * @param {import('./timeline.js').CueKind} kind Signal to play.
 * @param {number} [delay] Milliseconds from now.
 * @returns {void}
 */
export const play = (kind, delay = 0) => {
  if (muted || !context || context.state !== 'running') return;

  const begin = context.currentTime + delay / MS;

  CUES[kind].forEach(({ frequency, offset, length }) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = begin + offset;

    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(SILENCE, start);
    gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, start + ATTACK);
    gain.gain.exponentialRampToValueAtTime(SILENCE, start + length);
    oscillator.connect(gain).connect(context.destination);
    oscillator.addEventListener('ended', () => playing.delete(gain), { once: true });
    oscillator.start(start);
    oscillator.stop(start + length + ATTACK);
    playing.add(gain);
  });
};
