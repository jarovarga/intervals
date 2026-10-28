import { MS } from './time.js';

/**
 * Scroll text that is wider than its container back and forth, holding still at each end. The first child holds the
 * text; the container gets `data-overflowing` while the text overflows. The slide moves by whole device pixels at the
 * given speed whatever the pauses are, pauses while the container is off-screen and stands still for visitors who
 * ask for reduced motion.
 *
 * @param {string} selector Containers whose first child holds the text.
 * @param {Object} [options={}] Marquee options.
 * @param {number} [options.speed=40] Speed in pixels per second.
 * @param {number} [options.pause=1.5] Pause at each end in seconds.
 * @returns {void}
 */
export const init = (selector, { speed = 40, pause = 1.5 } = {}) => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll(selector).forEach((container) => {
    const text = container.firstElementChild;

    if (!text) return;

    let animation;
    let frame;
    let current = 0;
    let visible = true;

    const syncPlayback = () => {
      if (!animation) return;

      if (visible) {
        animation.play();
      } else {
        animation.pause();
      }
    };

    const stop = () => {
      animation?.cancel();
      animation = undefined;
      current = 0;
    };

    const slide = (shift) => {
      const travel = shift / speed;
      const cycle = 2 * (travel + pause);
      const hold = pause / cycle;
      const there = hold + travel / cycle;
      const away = `translateX(-${shift}px)`;
      // Stepping by device pixel keeps the text on whole pixels while it moves, so sub-pixel positioning does not
      // make the glyphs wobble.
      const stepped = `steps(${Math.max(1, Math.round(shift * (window.devicePixelRatio || 1)))}, end)`;
      const keyframes = [
        { offset: 0, transform: 'translateX(0)' },
        { offset: hold, transform: 'translateX(0)', easing: stepped },
        { offset: there, transform: away },
        { offset: there + hold, transform: away, easing: stepped },
        { offset: 1, transform: 'translateX(0)' }
      ];
      const timing = { duration: cycle * MS, easing: 'linear', iterations: Infinity };

      if (animation) {
        animation.effect.setKeyframes(keyframes);
        animation.effect.updateTiming(timing);
      } else {
        animation = text.animate(keyframes, timing);
      }

      current = shift;
      syncPlayback();
    };

    const update = () => {
      frame = undefined;

      const shift = Math.max(0, text.scrollWidth - container.clientWidth);

      container.toggleAttribute('data-overflowing', shift > 0);

      // The slide only changes when what it has to cover changes.
      if (shift === current && (animation || reducedMotion.matches)) return;

      if (shift > 0 && !reducedMotion.matches) {
        slide(shift);
      } else {
        stop();
      }
    };

    const queueUpdate = () => {
      if (frame !== undefined) return;

      frame = window.requestAnimationFrame(update);
    };

    const initialise = () => {
      if (!container.isConnected) return;

      update();

      // The text changes with the step and its width with the layout, so measure on both.
      const observer = new ResizeObserver(queueUpdate);

      observer.observe(container);
      observer.observe(text);
      new MutationObserver(queueUpdate).observe(text, { characterData: true, childList: true, subtree: true });
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        syncPlayback();
      }).observe(container);
      reducedMotion.addEventListener('change', () => {
        stop();
        queueUpdate();
      });
    };

    // The slide depends on the final font metrics.
    Promise.resolve(document.fonts?.ready).then(initialise, initialise);
  });
};
