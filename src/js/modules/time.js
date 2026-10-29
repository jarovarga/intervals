export const MS = 1000;

/** Longest time a field accepts: 99:59. */
export const MAX_SECONDS = 99 * 60 + 59;

const SECONDS_PER_MINUTE = 60;
const twoDigits = new Intl.NumberFormat('en-GB', { minimumIntegerDigits: 2, useGrouping: false });

/**
 * Parse a typed time such as `:30` or `1:30` (minutes and seconds), or `30` and `130` (seconds).
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
 * Format seconds the way the time fields show them: `:30`, `1:30`.
 *
 * @param {number} total Whole seconds.
 * @returns {string} Field text.
 */
export const formatField = (total) => {
  const minutes = Math.floor(total / SECONDS_PER_MINUTE);
  const seconds = twoDigits.format(total % SECONDS_PER_MINUTE);

  return minutes === 0 ? `:${seconds}` : `${minutes}:${seconds}`;
};

/**
 * Format seconds as the big clock does: `00:30`, `01:30`.
 *
 * @param {number} total Whole seconds.
 * @returns {string} Clock text.
 */
export const formatClock = (total) =>
  `${twoDigits.format(Math.floor(total / SECONDS_PER_MINUTE))}:${twoDigits.format(total % SECONDS_PER_MINUTE)}`;

/**
 * Format a total as minutes and seconds: `0:30`, `5:20`.
 *
 * @param {number} total Whole seconds.
 * @returns {string} Duration text.
 */
export const formatTotal = (total) =>
  `${Math.floor(total / SECONDS_PER_MINUTE)}:${twoDigits.format(total % SECONDS_PER_MINUTE)}`;
