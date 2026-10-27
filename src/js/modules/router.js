const HOME = 'home';

/**
 * @typedef {{
 *   element: HTMLElement,
 *   title: (params: string[]) => string,
 *   show: (params: string[]) => boolean | void,
 *   leave?: () => void
 * }} View
 */

/** Callback that draws the current route; set by `init`. */
let render = () => {};

/**
 * @param {string} route Route such as `/edit/abc`; a leading `#` is ignored.
 * @returns {{ name: string, params: string[] }} View name and the path segments after it.
 */
const parse = (route) => {
  const [name, ...params] = route.replace(/^#?\/?/, '').split('/');

  return { name: name || HOME, params };
};

/**
 * Go to a view. The route lives in the history state, not in the address bar, so the URL stays the same while Back
 * still works.
 *
 * @param {string} route Target route, such as `#/edit/abc` or `/`.
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
 * Show the view named by the current route and keep following it. Each view hides while another shows, with a
 * cross-fade between them where the browser supports view transitions.
 *
 * A page opened with a `#/…` address, such as a link opened in a new tab, shows that view and then drops the
 * address. A reload shows the same view again, because the history state survives it.
 *
 * @param {string} selector Selector of the view elements.
 * @param {{ views: Record<string, View> }} options Views by name; unknown names show the home view.
 * @returns {void}
 */
export const init = (selector, { views }) => {
  const elements = document.querySelectorAll(selector);
  /** @type {View | null} */
  let active = null;
  let first = true;

  const update = () => {
    const { name, params } = parse(history.state?.route ?? '/');
    const view = views[name] ?? views[HOME];

    active?.leave?.();
    elements.forEach((element) => {
      element.hidden = true;
    });

    if (view.show(params) === false) {
      active = null;
      // Replace the bad entry, so that Back does not return to it and bounce home again.
      navigate('/', { replace: true });
      return;
    }

    active = view;
    view.element.hidden = false;
    document.title = view.title(params);
    window.scrollTo(0, 0);

    // Moving focus tells screen reader users that the screen changed; on first load there is nothing to announce.
    if (!first) view.element.querySelector('[tabindex="-1"]')?.focus({ preventScroll: true });

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
    const link = event.target.closest('a[href^="#/"]');

    const plainClick = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey;

    if (!link || event.defaultPrevented || !plainClick) return;

    event.preventDefault();
    navigate(link.getAttribute('href'));
  });

  window.addEventListener('popstate', () => render());

  // An address typed or pasted into the bar while the app is open.
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#/')) navigate(location.hash);
  });

  const opened = location.hash.startsWith('#/') ? location.hash : null;

  history.replaceState({ route: (opened ?? history.state?.route ?? '/').replace(/^#/, '') }, '', location.pathname);
  render();
};
