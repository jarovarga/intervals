/**
 * Make the `details` menus that match a selector behave like menus: one open at a time, closed by a click elsewhere
 * or by Escape, which returns focus to the button that opened it.
 *
 * @param {string} [selector] Selector of the menus.
 * @returns {void}
 */
export const init = (selector = '[data-menu]') => {
  const open = () => /** @type {HTMLDetailsElement[]} */ ([...document.querySelectorAll(`${selector}[open]`)]);

  document.addEventListener('click', (event) => {
    const target = /** @type {Node} */ (event.target);

    open().forEach((menu) => {
      if (!menu.contains(target)) menu.open = false;
    });
  });

  // A menu that opens closes the others; toggle events do not bubble, so they are caught on the way down.
  document.addEventListener(
    'toggle',
    (event) => {
      const menu = /** @type {HTMLDetailsElement} */ (event.target);

      if (!menu.matches?.(selector) || !menu.open) return;

      open().forEach((other) => {
        if (other !== menu) other.open = false;
      });
    },
    true
  );

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    open().forEach((menu) => {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    });
  });
};
