/**
 * Tell styles whether the user points or types: the root element carries the class `is-pointer` after a touch or a
 * click and loses it with the next key, so that a focus ring the browser draws for a focus that a tap caused, such as
 * the autofocus of a dialog, can stay hidden while it still shows for the keyboard.
 *
 * @param {string} [className] Class that marks pointer input.
 * @returns {void}
 */
export const init = (className = 'is-pointer') => {
  const root = document.documentElement;

  document.addEventListener('pointerdown', () => root.classList.add(className), { capture: true, passive: true });
  document.addEventListener('keydown', () => root.classList.remove(className), { capture: true, passive: true });
};
