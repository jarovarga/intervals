/** @type {WakeLockSentinel | null} */
let sentinel = null;
let wanted = false;
let requesting = false;
let enabled = true;

/**
 * Allow or forbid the lock from now on; forbidding it also lets go of a lock that is held.
 *
 * @param {boolean} value Whether the screen may be kept on.
 * @returns {Promise<void>}
 */
export const setEnabled = async (value) => {
  enabled = value;

  if (!enabled) {
    await release();
  }
};

/**
 * Keep the screen on while a workout runs. The browser drops the lock when the page is hidden, so it is requested
 * again once the page is visible. A refused request is reported, not thrown, so the promise never rejects.
 *
 * @returns {Promise<void>}
 */
export const acquire = async () => {
  wanted = true;

  if (!enabled || !('wakeLock' in navigator) || sentinel || requesting) return;

  requesting = true;

  try {
    const lock = await navigator.wakeLock.request('screen');

    // The workout may have paused or ended while the request was pending.
    if (!wanted) {
      await lock.release();
      return;
    }

    sentinel = lock;
    lock.addEventListener(
      'release',
      () => {
        if (sentinel === lock) sentinel = null;
      },
      { once: true }
    );
  } catch (error) {
    console.warn('The screen could not be kept awake.', error);
  } finally {
    requesting = false;
  }
};

/**
 * Let the screen sleep again. A lock that cannot be released is reported, not thrown, so the promise never rejects.
 *
 * @returns {Promise<void>}
 */
export const release = async () => {
  wanted = false;

  if (!sentinel) return;

  const held = sentinel;

  sentinel = null;

  try {
    await held.release();
  } catch (error) {
    console.warn('The screen lock could not be released.', error);
  }
};

/**
 * Request the lock again when the page comes back, if a workout still wants the screen on.
 *
 * @returns {void}
 */
export const init = () => {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wanted) void acquire();
  });
};
