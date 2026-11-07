/**
 * Pick the screen that a fragment names.
 *
 * @param {string} hash Fragment of the address, such as `#log`; an empty one names no screen.
 * @param {string[]} screens Identifiers of the screens.
 * @param {string} home Screen shown when the fragment names none of them.
 * @returns {string} Identifier of the screen to show.
 */
export const resolve = (hash, screens, home) => {
  const id = hash.replace(/^#/, '');

  return screens.includes(id) ? id : home;
};

/** Writes the page title of the screen in view; set by `init`. */
let writeTitle = () => {};

/**
 * Write the page title again, for example after the language changed.
 *
 * @returns {void}
 */
export const refreshTitle = () => writeTitle();

/** Shows the screen of the address; set by `init`. */
let render = () => {};

/**
 * Go to a screen from a script, for example after saving a workout.
 *
 * @param {string} hash Fragment of the screen, such as `#workouts`.
 * @param {{ workout?: string, resume?: boolean } | null} [state] What the screen needs to know, such as the workout to show.
 * @param {{ replace?: boolean }} [options] Replace the current history entry instead of adding one, so that Back skips it.
 * @returns {void}
 */
export const go = (hash, state = null, { replace = false } = {}) => {
  if (replace) {
    history.replaceState(state, '', hash);
  } else {
    history.pushState(state, '', hash);
  }

  render();
};

/**
 * Show one screen at a time: the section that the fragment of the address names, or the home screen. Links to a
 * screen stay plain fragment links; the router follows them itself, so that the page does not jump to the section,
 * and cross-fades the screens where the browser supports view transitions and motion is not reduced.
 *
 * A screen marked `data-layout="full"` covers the whole page, so the navigation hides while it shows. A link with
 * `data-workout` hands that workout to its screen in the history state, which survives a reload. Every screen that
 * shows receives a `screen:show` event with that state and whether the page has just loaded, so that it can draw
 * itself first, and the screen it replaces a `screen:hide` event, so that it can stop what it runs. A link with
 * `data-resume` also asks its screen to pick its workout up where it stopped.
 *
 * @param {string} selector Selector of the screen sections, each with an `id`.
 * @param {{ home: string, navigation: string, appTitle: () => string }} options Identifier of the home screen, selector of the navigation and the name of the app for the page title.
 * @returns {void}
 */
export const init = (selector, { home, navigation, appTitle }) => {
  const sections = /** @type {HTMLElement[]} */ ([...document.querySelectorAll(selector)]);
  const screens = sections.map((section) => section.id);
  const header = /** @type {HTMLElement | null} */ (document.querySelector(navigation));

  if (!header || !screens.includes(home)) return;

  const links = /** @type {HTMLAnchorElement[]} */ ([...header.querySelectorAll('a[href^="#"]')]);
  let first = true;
  /** @type {HTMLElement | null} */
  let current = null;

  // Every screen starts at the top, so the browser must not restore the scroll position of a reload over it.
  history.scrollRestoration = 'manual';

  const update = () => {
    const id = resolve(location.hash, screens, home);
    const screen = sections.find((section) => section.id === id);
    const heading = /** @type {HTMLElement | null} */ (screen.querySelector('[tabindex="-1"]'));

    writeTitle = () => {
      document.title = id === home || !heading ? appTitle() : `${heading.textContent} – ${appTitle()}`;
    };
    sections.forEach((section) => {
      section.hidden = section !== screen;
    });
    header.hidden = screen.dataset.layout === 'full';

    if (current && current !== screen) current.dispatchEvent(new CustomEvent('screen:hide'));

    current = screen;
    screen.dispatchEvent(new CustomEvent('screen:show', { detail: { ...history.state, initial: first } }));
    links.forEach((link) => {
      if (link.hash === `#${id}`) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
    writeTitle();
    // The page scrolls smoothly, which a new screen must not inherit.
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Moving focus tells screen reader users that the screen changed; on the first load there is nothing to announce.
    if (!first) heading?.focus({ preventScroll: true });

    first = false;
  };

  render = () => {
    if (first || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      update();
      return;
    }

    document.startViewTransition(update);
  };

  document.addEventListener('click', (event) => {
    const link = /** @type {Element} */ (event.target).closest('a[href^="#"]');
    const plainClick = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

    if (!link || event.defaultPrevented || !plainClick) return;
    if (!screens.includes(link.getAttribute('href').slice(1))) return;

    const { workout, resume } = /** @type {HTMLElement} */ (link).dataset;
    let state = null;

    if (workout) state = resume ? { workout, resume: true } : { workout };

    event.preventDefault();

    // A new entry is needed when the screen or what it shows changes.
    if (JSON.stringify(state) !== JSON.stringify(history.state) || link.getAttribute('href') !== location.hash) {
      history.pushState(state, '', link.getAttribute('href'));
    }

    render();
  });

  // Back, Forward and a fragment typed into the address bar.
  window.addEventListener('popstate', render);
  window.addEventListener('hashchange', render);

  render();
};
