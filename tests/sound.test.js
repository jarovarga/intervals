import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { collectWarnings, fakeDocument, restoreGlobals, setGlobal } from './helpers/globals.js';

let imports = 0;

/** The module keeps its audio context in module state, so every test loads a fresh copy. */
const loadSound = () => {
  imports += 1;

  return import(`../src/js/modules/sound.js?test=${imports}`);
};

/**
 * Install an audio context that records what is scheduled on it.
 *
 * @param {{ resumeFails?: boolean }} [options] A context that refuses to resume.
 * @returns {{ contexts: object[] }} The contexts the code under test created.
 */
const fakeAudio = ({ resumeFails = false } = {}) => {
  const contexts = [];

  class FakeContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 10;
      this.sampleRate = 44100;
      this.destination = {};
      this.sources = [];
      this.oscillators = [];
      this.gains = [];
      this.resumes = 0;
      contexts.push(this);
    }

    resume() {
      this.resumes += 1;

      if (resumeFails) return Promise.reject(new Error('Interrupted'));

      this.state = 'running';

      return Promise.resolve();
    }

    createBuffer(channels, length, sampleRate) {
      return { channels, length, sampleRate };
    }

    createBufferSource() {
      const source = { buffer: null, started: 0, connect: () => {}, start: () => (source.started += 1) };

      this.sources.push(source);

      return source;
    }

    createOscillator() {
      const oscillator = {
        frequency: { value: 0 },
        startedAt: null,
        stoppedAt: null,
        connect: (node) => node,
        addEventListener: () => {},
        start: (at) => (oscillator.startedAt = at),
        stop: (at) => (oscillator.stoppedAt = at)
      };

      this.oscillators.push(oscillator);

      return oscillator;
    }

    createGain() {
      const gain = {
        ramps: [],
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: (value) => gain.ramps.push(value) },
        disconnected: false,
        connect: () => {},
        disconnect: () => (gain.disconnected = true)
      };

      this.gains.push(gain);

      return gain;
    }
  }

  setGlobal('AudioContext', FakeContext);

  return { contexts };
};

afterEach(restoreGlobals);

test('without audio support the sound counts as ready and does nothing', async () => {
  setGlobal('AudioContext', undefined);

  const sound = await loadSound();

  assert.equal(sound.isReady(), true);
  assert.equal(sound.isRunning(), false);
  assert.doesNotThrow(() => {
    sound.unlock();
    sound.play('tick');
    sound.cancel();
  });
});

test('a tap unlocks the audio: the context is made, resumed and a silent buffer is played', async () => {
  const audio = fakeAudio();
  const sound = await loadSound();

  assert.equal(sound.isReady(), false);

  sound.unlock();

  const [context] = audio.contexts;

  assert.equal(audio.contexts.length, 1);
  assert.equal(sound.isReady(), true);
  assert.equal(sound.isRunning(), true);
  assert.equal(context.sources[0].started, 1);
  assert.equal(context.sources[0].buffer.length, 1);
});

test('unlocking again keeps the one context', async () => {
  const audio = fakeAudio();
  const sound = await loadSound();

  sound.unlock();
  sound.unlock();

  assert.equal(audio.contexts.length, 1);
});

test('a signal is scheduled on the audio clock after its delay', async () => {
  const audio = fakeAudio();
  const sound = await loadSound();

  sound.unlock();
  sound.play('tick', 500);

  const [oscillator] = audio.contexts[0].oscillators;

  assert.equal(oscillator.frequency.value, 660);
  assert.equal(oscillator.startedAt, 10.5);
  assert.ok(Math.abs(oscillator.stoppedAt - (10.5 + 0.12 + 0.005)) < 1e-9);
});

test('the volume scales the loudness of the signals scheduled afterwards', async () => {
  const audio = fakeAudio();
  const sound = await loadSound();

  sound.unlock();
  sound.play('tick');
  sound.setVolume(0.5);
  sound.play('tick');
  sound.setVolume(7);
  sound.play('tick');

  const peaks = audio.contexts[0].gains.map((gain) => gain.ramps[0]);

  assert.deepEqual(peaks, [0.4, 0.2, 0.4]);
});

test('a signal of several notes schedules every note at its offset', async () => {
  const audio = fakeAudio();
  const sound = await loadSound();

  sound.unlock();
  sound.play('round');

  const starts = audio.contexts[0].oscillators.map((oscillator) => oscillator.startedAt);

  assert.deepEqual(starts, [10, 10.3]);
});

test('nothing is scheduled before the audio is unlocked or while it is not running', async () => {
  const audio = fakeAudio();
  const sound = await loadSound();

  sound.play('tick');

  assert.equal(audio.contexts.length, 0);

  sound.unlock();
  audio.contexts[0].state = 'suspended';
  sound.play('tick');

  assert.equal(audio.contexts[0].oscillators.length, 0);
});

test('muting silences what is scheduled and keeps new signals quiet until the sound is back', async () => {
  const audio = fakeAudio();
  const sound = await loadSound();

  sound.unlock();
  sound.play('tick');
  sound.setMuted(true);

  const [context] = audio.contexts;

  assert.equal(context.gains[0].disconnected, true);

  sound.play('tick');

  assert.equal(context.oscillators.length, 1);

  sound.setMuted(false);
  sound.play('tick');

  assert.equal(context.oscillators.length, 2);
});

test('cancelling silences every signal that is scheduled', async () => {
  const audio = fakeAudio();
  const sound = await loadSound();

  sound.unlock();
  sound.play('done');
  sound.cancel();

  assert.equal(audio.contexts[0].gains.length, 3);
  assert.ok(audio.contexts[0].gains.every((gain) => gain.disconnected));
});

test('the audio is resumed when the page comes back after iOS suspended it', async () => {
  const page = fakeDocument();

  setGlobal('document', page);

  const audio = fakeAudio();
  const sound = await loadSound();

  sound.init();
  sound.unlock();

  const [context] = audio.contexts;

  // iOS suspends the context while the page is hidden.
  page.hide();
  context.state = 'suspended';
  page.show();

  assert.equal(context.resumes, 2);
  assert.equal(context.state, 'running');
});

test('the audio is left alone when it still runs or was never unlocked', async () => {
  const page = fakeDocument();

  setGlobal('document', page);

  const audio = fakeAudio();
  const sound = await loadSound();

  sound.init();
  page.show();

  assert.equal(audio.contexts.length, 0);

  sound.unlock();
  page.hide();
  page.show();

  assert.equal(audio.contexts[0].resumes, 1);
});

test('a refused resume is reported and the app carries on', async (context) => {
  const warnings = collectWarnings(context);
  const page = fakeDocument();

  setGlobal('document', page);

  fakeAudio({ resumeFails: true });

  const sound = await loadSound();

  sound.init();
  sound.unlock();
  page.show();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(warnings, ['The audio could not be resumed.', 'The audio could not be resumed.']);
});
