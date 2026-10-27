/** @type {WakeLockSentinel | null} */
let sentinel = null;
let wanted = false;
let requesting = false;

/**
 * Keep the screen on while a workout runs. The browser drops the lock when the page is hidden, so it is requested
 * again once the page is visible.
 *
 * @returns {Promise<void>}
 */
export const acquire = async () => {
  wanted = true;

  if (!('wakeLock' in navigator) || sentinel || requesting) return;

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
 * Let the screen sleep again.
 *
 * @returns {Promise<void>}
 */
export const release = async () => {
  wanted = false;

  if (!sentinel) return;

  const held = sentinel;

  sentinel = null;
  await held.release();
};

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wanted) acquire();
});
