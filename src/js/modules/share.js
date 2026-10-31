import * as dialog from './dialog.js';
import * as library from './library.js';
import { count } from './plural.js';
import * as router from './router.js';
import { formatTotal } from './time.js';
import { readWorkout, totalSeconds } from './workout.js';

/** What a shared address carries in its hash, followed by the workout. The hash never reaches a server. */
const PREFIX = '#share=';

/** Longest workout a link carries, in characters; a longer link is too long for some messengers. */
const MAX_PAYLOAD_LENGTH = 8000;

const SHARE_TEXT = 'A workout for the Intervals timer';

/**
 * @param {string} text Text of any script.
 * @returns {string} The UTF-8 bytes of the text as URL-safe Base64 without padding.
 */
const toBase64Url = (text) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');

/**
 * @param {string} payload URL-safe Base64.
 * @returns {string} The decoded text.
 * @throws {Error} When the payload is not Base64 or not UTF-8.
 */
const fromBase64Url = (payload) => {
  const binary = atob(payload.replaceAll('-', '+').replaceAll('_', '/'));

  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
};

/**
 * Put a workout in a link that opens the app and offers to add it. The identifiers stay out, so that the workout
 * never replaces one of the receiver.
 *
 * @param {import('./workout.js').Workout} workout Workout to share.
 * @param {string} base Address of the app, without a hash.
 * @returns {string | null} The link, or null when the workout is too large for one.
 */
export const createLink = (workout, base) => {
  const { name, colour, prepare, rest, rounds, roundRest, exercises } = workout;
  const shared = {
    name,
    colour,
    prepare,
    rest,
    rounds,
    roundRest,
    exercises: exercises.map((exercise) => ({ name: exercise.name, time: exercise.time }))
  };
  const payload = toBase64Url(JSON.stringify(shared));

  return payload.length > MAX_PAYLOAD_LENGTH ? null : `${base}${PREFIX}${payload}`;
};

/**
 * @param {string} hash Hash of the address the app was opened with.
 * @returns {import('./workout.js').Workout | null} A new workout with fresh identifiers, or null when the hash holds no
 *   usable shared workout.
 */
export const readLink = (hash) => {
  if (!hash.startsWith(PREFIX) || hash.length - PREFIX.length > MAX_PAYLOAD_LENGTH) return null;

  try {
    const raw = JSON.parse(fromBase64Url(hash.slice(PREFIX.length)));
    const exercises = Array.isArray(raw?.exercises)
      ? raw.exercises.map((exercise) => ({ ...exercise, id: crypto.randomUUID() }))
      : [];
    const workout = readWorkout({ ...raw, id: crypto.randomUUID(), exercises });

    return workout?.exercises.length ? workout : null;
  } catch {
    return null;
  }
};

/**
 * Hand a workout to the share sheet of the device, or copy its link where there is none.
 *
 * @param {import('./workout.js').Workout} workout Workout to share.
 * @returns {Promise<'shared' | 'copied' | 'cancelled' | 'too-large' | 'failed'>} What happened.
 */
export const send = async (workout) => {
  const link = createLink(workout, `${location.origin}${location.pathname}`);

  if (!link) return 'too-large';

  if (navigator.share) {
    try {
      await navigator.share({ title: workout.name.trim(), text: SHARE_TEXT, url: link });

      return 'shared';
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelled';

      console.warn('The share sheet failed, so the link is copied instead.', error);
    }
  }

  try {
    await navigator.clipboard.writeText(link);

    return 'copied';
  } catch (error) {
    console.warn('The link could not be copied.', error);

    return 'failed';
  }
};

/**
 * @param {import('./workout.js').Workout} workout Workout from a link.
 * @returns {Promise<void>}
 */
const offer = async (workout) => {
  const confirmed = await dialog.ask({
    title: 'Add shared workout?',
    text: `“${workout.name}” has ${count(workout.exercises.length, 'exercise', 'exercises')} and takes ${formatTotal(totalSeconds(workout))}.`,
    confirmLabel: 'Add',
    danger: false
  });

  if (!confirmed) return;

  library.saveWorkout(workout);
  router.navigate('#/', { replace: true });
};

/**
 * Offer to add the workout that a shared link carries. Call it before the router starts, which drops the hash from
 * the address, so that reloading the page does not offer the workout again.
 *
 * @returns {void}
 */
export const init = () => {
  const workout = readLink(location.hash);

  if (workout) {
    offer(workout).catch((error) => console.warn('The shared workout could not be added.', error));
  }
};
