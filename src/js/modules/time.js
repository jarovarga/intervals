export const MS = 1000;

/** Longest time a field accepts: 99:59. */
export const MAX_SECONDS = 99 * 60 + 59;

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const twoDigits = new Intl.NumberFormat('en-GB', { minimumIntegerDigits: 2, useGrouping: false });

/**
 * Parse a typed time such as `0:30` or `1:30` (minutes and seconds), or `30` and `130` (seconds).
 *
 * @param {string} text Typed value.
 * @param {{ allowZero?: boolean }} [options] Whether `0` is a valid time.
 * @returns {number | null} Seconds, or null when the text is not a valid time.
 */
export const parse = (text, { allowZero = false } = {}) => {
  const value = String(text).trim();
  let minutes;
  let seconds;

  if (/^\d{0,2}:\d{1,2}$/.test(value)) {
    const [left, right] = value.split(':');
    minutes = Number(left || 0);
    seconds = Number(right);
  } else if (/^\d{1,4}$/.test(value)) {
    minutes = 0;
    seconds = Number(value);
  } else {
    return null;
  }

  if (value.includes(':') && seconds >= SECONDS_PER_MINUTE) return null;

  const total = minutes * SECONDS_PER_MINUTE + seconds;

  if (total > MAX_SECONDS || (total === 0 && !allowZero)) return null;

  return total;
};

/**
 * Format seconds the way the app shows every time: `0:30`, `18:42`, and from an hour on `4:52:10`.
 *
 * @param {number} total Whole seconds.
 * @returns {string} Time text.
 */
export const format = (total) => {
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = twoDigits.format(total % SECONDS_PER_MINUTE);

  return hours === 0 ? `${minutes}:${seconds}` : `${hours}:${twoDigits.format(minutes)}:${seconds}`;
};

/**
 * Format seconds the way the time fields show them, in minutes even past an hour: `0:30`, `99:59`.
 *
 * @param {number} total Whole seconds.
 * @returns {string} Field text.
 */
export const formatField = (total) =>
  `${Math.floor(total / SECONDS_PER_MINUTE)}:${twoDigits.format(total % SECONDS_PER_MINUTE)}`;
