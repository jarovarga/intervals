/**
 * Where a running workout stands on its clock, without any page or timer attached. The time is always handed in, so
 * the state can be followed and tested with made-up moments. `elapsedBefore` is the active milliseconds before the
 * last resume and `resumedAt` is the moment of that resume, or null while the clock is stopped.
 *
 * @typedef {{ elapsedBefore: number, resumedAt: number | null }} Transport
 */

/**
 * @param {number} [at] Active milliseconds to begin from.
 * @returns {Transport} A stopped clock.
 */
export const create = (at = 0) => ({ elapsedBefore: at, resumedAt: null });

/**
 * @param {Transport} transport Clock to ask.
 * @returns {boolean} Whether the clock is running.
 */
export const isRunning = ({ resumedAt }) => resumedAt !== null;

/**
 * @param {Transport} transport Clock to read.
 * @param {number} now The current moment in milliseconds.
 * @returns {number} Active milliseconds since the start.
 */
export const elapsed = (transport, now) =>
  transport.elapsedBefore + (isRunning(transport) ? now - transport.resumedAt : 0);

/**
 * @param {Transport} transport Clock to start; one that already runs is left as it is.
 * @param {number} now The current moment in milliseconds.
 * @returns {Transport} The running clock.
 */
export const start = (transport, now) => (isRunning(transport) ? transport : { ...transport, resumedAt: now });

/**
 * @param {Transport} transport Clock to stop.
 * @param {number} now The current moment in milliseconds.
 * @returns {Transport} The stopped clock, holding the time it had reached.
 */
export const pause = (transport, now) => create(elapsed(transport, now));

/**
 * Move the clock to another position and keep it running, or stopped, as it was.
 *
 * @param {Transport} transport Clock to move.
 * @param {number} at Active milliseconds to move to.
 * @param {number} now The current moment in milliseconds.
 * @returns {Transport} The moved clock.
 */
export const jumpTo = (transport, at, now) => ({ elapsedBefore: at, resumedAt: isRunning(transport) ? now : null });
