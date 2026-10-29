const INTRO = 'intro';

/**
 * What follows the screen name in a route such as `/timer/abc/resume`: the workout identifier and a mode.
 *
 * @typedef {{ id: string | undefined, mode: string | undefined }} Route
 */

/**
 * @typedef {{
 *   element: HTMLElement,
 *   title: (route: Route) => string,
 *   show: (route: Route, options: { initial: boolean }) => boolean | void,
 *   leave?: () => void
 * }} Screen
 */

/** Callback that draws the current route; set by `init`. */
let render = () => {};

/**
 * @param {string} route Route such as `/edit/abc`; a leading `#` is ignored.
 * @returns {{ name: string, route: Route }} Screen name and what follows it.
 */
const parse = (route) => {
  const [name, id, mode] = route.replace(/^#?\/?/, '').split('/');

  return { name: name || INTRO, route: { id, mode } };
};

/**
 * Go to a screen. The route lives in the history state, not in the address bar, so the URL stays the same while Back
 * still works.
 *
 * @param {string} route Target route, such as `#/edit/abc` or `#/`.
 * @param {{ replace?: boolean }} [options] Replace the current history entry instead of adding one.
 * @returns {void}
 */
export const navigate = (route, { replace = false } = {}) => {
  const state = { route: route.replace(/^#/, '') };

  if (replace) {
    history.replaceState(state, '', location.pathname);
  } else {
    history.pushState(state, '', location.pathname);
  }

  render();
};

/**
 * Show the screen named by the current route and keep following it. Each screen hides while another shows, with a
 * cross-fade between them where the browser supports view transitions.
 *
 * A page opened with a `#/…` address, such as a link opened in a new tab, shows that screen and then drops the
 * address. A reload shows the same screen again, because the history state survives it.
 *
 * @param {string} selector Selector of the screen elements.
 * @param {{ screens: Record<string, Screen> }} options Screens by name; unknown names show the intro screen.
 * @returns {void}
 */
export const init = (selector, { screens }) => {
  const elements = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(selector));
  /** @type {Screen | null} */
  let active = null;
  let first = true;

  const update = () => {
    const { name, route } = parse(history.state?.route ?? '/');
    const screen = screens[name] ?? screens[INTRO];

    active?.leave?.();
    elements.forEach((element) => {
      element.hidden = true;
    });

    if (screen.show(route, { initial: first }) === false) {
      active = null;
      // Replace the bad entry, so that Back does not return to it and bounce back to the intro again.
      navigate('#/', { replace: true });
      return;
    }

    active = screen;
    screen.element.hidden = false;
    document.title = screen.title(route);
    // The page sets smooth scrolling, which a new screen must not inherit.
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Moving focus tells screen reader users that the screen changed; on first load there is nothing to announce.
    if (!first) {
      const heading = /** @type {HTMLElement | null} */ (screen.element.querySelector('[tabindex="-1"]'));

      heading?.focus({ preventScroll: true });
    }

    first = false;
  };

  // The browser cross-fades the old and the new screen; where it cannot, or when motion is reduced, the screens switch.
  render = () => {
    if (first || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      update();
      return;
    }

    document.startViewTransition(update);
  };

  // The route links are plain anchors, so that they stay links; the router follows them without changing the address.
  document.addEventListener('click', (event) => {
    const target = /** @type {Element} */ (event.target);
    const link = target.closest('a[href^="#/"]');

    const plainClick = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey;

    if (!link || event.defaultPrevented || !plainClick) return;

    event.preventDefault();
    navigate(link.getAttribute('href'));
  });

  window.addEventListener('popstate', () => render());

  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#/')) navigate(location.hash);
  });

  const opened = location.hash.startsWith('#/') ? location.hash : null;

  history.replaceState({ route: (opened ?? history.state?.route ?? '/').replace(/^#/, '') }, '', location.pathname);
  render();
};
