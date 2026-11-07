# Progressive web apps

Apply these rules to installable, offline-capable web apps. Where the project uses a library such as Workbox, configure the behaviour below through it instead of hand-writing it.

## Delivery

- Serve the app over HTTPS. Service workers and the Screen Wake Lock API need a secure context, and `crypto.randomUUID()` is unavailable without one; `localhost` qualifies, a plain `http://` address on the local network does not.
- Serve the worker from the root of the path it controls, and resolve manifest and worker URLs relative to the app's scope, so that the app also works from a subpath.
- Register the worker with `updateViaCache: 'none'` and still serve it and its imported scripts with `Cache-Control: max-age=0` for older browsers, which may otherwise reuse a cached copy for up to 24 hours.
- Serve the manifest as `application/manifest+json`.
- Generate the cache version, a content hash of the built files, and the precache list from the build output, and keep files the app does not use out of that output. Never maintain either by hand: a changed worker byte is what triggers an update.
- Never rename or move the worker URL after release: the old registration keeps controlling its clients. To retire a worker, deploy one at the same URL that deletes its caches and calls `self.registration.unregister()`; a deployment that never deletes remote files keeps serving a removed worker.
- Treat the built manifest and worker as generated output: ignore them in Git and lint the worker source with service-worker globals, such as `globals.serviceworker` in ESLint.

## Manifest

- Set `id`, `name`, `short_name`, `description`, `lang`, `dir`, `start_url`, `scope`, `display`, `theme_color` and `background_color`. Match `theme_color` to the `theme-color` meta tag and `background_color` to the first painted background.
- Never change `id` after release; browsers then treat the app as a new one. Without an `id`, `start_url` identifies the app, so set `id` before changing `start_url`.
- Provide an SVG icon with `"purpose": "any"`, PNG icons of 192 and 512 pixels and a separate 512-pixel `maskable` PNG whose content stays inside the central safe zone. Never combine purposes as `"any maskable"`.
- Add `screenshots` only when the richer Chromium install dialogue is wanted.
- Keep the manifest reachable: when Chrome on Android cannot fetch it, it may wait up to 30 days before checking again.
- iOS, iPadOS and Android browsers other than Chrome do not update installed metadata; a new name or icon reaches users only after they reinstall.

## Document head

- Link the manifest with `rel="manifest"` and keep the `theme-color` and `color-scheme` meta tags in step with it.
- Keep a 180-pixel PNG `apple-touch-icon` with an opaque background, because iOS fills transparent pixels with black. Safari reads manifest icons only since iOS 15.4, uses only those with `purpose` `any` and, in some versions, prefers the `apple-touch-icon` when both exist.
- Keep `apple-mobile-web-app-title` for the Home Screen label.
- Since iOS 26, every site added to the Home Screen opens as a web app and the manifest is optional, so omit `apple-mobile-web-app-capable` when the manifest sets `display`; where older iOS still needs it, add `mobile-web-app-capable` next to it.
- Extend the viewport meta tag to `width=device-width, viewport-fit=cover` and add `apple-mobile-web-app-status-bar-style` set to `black-translucent` only together with padding from `env(safe-area-inset-*)` on every edge that content reaches.
- Do not ship `apple-touch-startup-image` sets, which need an image for every device resolution; document the white launch flash on iOS as a known limitation instead.

## Service worker

- Name caches with an app prefix and the build hash. Precache the shell in `install` with `new Request(url, { cache: 'reload' })`, so that no stale HTTP-cached file enters the new cache, and in `activate` delete only the caches with the app's own prefix.
- Wrap all asynchronous work in `install` and `activate` in `event.waitUntil()`.
- Handle only same-origin `GET` requests; return without `respondWith()` for everything else, so that the browser handles it.
- Serve navigations from the cached shell for a single-page app, or network-first with a cached fallback for a multipage site, and answer a navigation that finds neither with a short `503` offline response instead of the browser's error page.
- Serve hashed or versioned assets cache-first by their full URL. Use `ignoreSearch: true` only when the cache holds a single build and the HTML that references the assets comes from the same cache.
- Cache only `ok` responses at runtime, and never cache personalised responses.
- Keep the worker free of DOM and `localStorage`, which do not exist there; use the Cache API or IndexedDB.
- Choose the update strategy deliberately:
  - By default, let the new worker wait and call `skipWaiting()` only after the user accepts the update notice.
  - Call `skipWaiting()` and `clients.claim()` immediately only when an old page can keep running against the new worker, for example because it loaded the whole app up front and requests nothing later from the cache.
- Never reload the page without the user's consent; a reload can interrupt running work or discard unsaved input.

## Registration and installation

- Register from the entry point after feature detection and report a failed registration with `console.warn` or `console.error` instead of throwing.
- On development hosts, such as `localhost`, `127.0.0.1` and `[::1]`, skip registration and unregister earlier workers and delete their caches, so that development always loads the current files.
- Check for updates with `registration.update()` when `visibilitychange` reports the page as visible, throttled to a minimum interval: a Home Screen app is resumed rather than relaunched, so the browser would not check by itself. Offer a manual check where the app has settings.
- Show the update notice to match the update strategy:
  - With a waiting worker, show it when `registration.waiting` is set or `updatefound` reaches `installed` while the page has a controller; after the user accepts, post a message that makes the worker call `skipWaiting()`, then reload on `controllerchange`.
  - With an immediate `skipWaiting()`, offer the reload on `controllerchange`, but only when the page already had a controller at load, because the first install also fires it.
- Safari offers no install prompt. Show a dismissible explanation of Add to Home Screen only to iOS and iPadOS browsers outside standalone mode, and remember the dismissal. Detecting the platform from `navigator.userAgent` is the accepted exception to feature detection here, because no feature reveals it; recognise iPadOS by `Macintosh` with `maxTouchPoints > 1` and never parse OS versions.
- Detect standalone mode with `matchMedia('(display-mode: standalone)')` or, on iOS, `navigator.standalone`.
- Keep platform decisions, such as whether to show the installation explanation, as pure functions of an injected environment, so that unit tests cover them without a browser.
- In Chromium, offer a custom installation button only when needed: call `preventDefault()` on `beforeinstallprompt`, keep the event, call `prompt()` from a click and hide the button after `appinstalled`.

## Standard features

Give every app these features, and adapt their wording and placement to the app:

- Install offer: the Add to Home Screen explanation described under Registration and installation, plus a button in the settings that shows it again after it was dismissed and stays hidden where it does not apply.
- Update offer: a notice with a Reload button inside a `role="status"` region that exists before the update, plus a Check for updates button in the settings that reports through a status message whether a new version was found, the app is current or the check failed.
- Version: the app version from the package metadata, inserted by the build in place of a placeholder such as `__APP_VERSION__`, shown at the end of the settings and raised only for a new feature or another significant change.
- Support link: a plain `Buy me a coffee` link to `https://ko-fi.com` account above the version, unless the project names another target; it does not open a new tab.
- Never block content behind installation.

## Standalone runtime

- Expect a Home Screen app to be resumed, not reloaded. On `visibilitychange`, restore what the system suspended, such as the wake lock, the `AudioContext` and the update check.
- Derive elapsed time from `Date.now()` timestamps, not counted ticks: timers are throttled or suspended in the background, and `performance.now()` can stand still while iOS suspends the page.
- iOS can end a Home Screen app in the background, and an accepted update reloads it. Save the state of a running activity, such as a timer, with a timestamp when the page is hidden and on `pagehide`, offer to resume it at the next start and discard it after a maximum age.
- Create or resume audio from a user gesture, and on iOS also play a short silent buffer inside it; resume the context after an interruption.
- Schedule sound cues on the `AudioContext` clock a short lookahead in advance, skip cues that fell due too long ago, and when the page returns, cancel and schedule them again from the real elapsed time, because iOS can hold the audio clock while the page is hidden.
- Request a screen wake lock only during the activity that needs it, release it afterwards, request it again when the page becomes visible and offer a setting to turn it off. Safari supports it in Home Screen web apps since 18.4.
- Provide in-app navigation and a way to reload or update, because standalone mode has no browser controls.

## App-like interface

- Set `touch-action: manipulation` on `html` and on scroll containers to stop the double-tap zoom on iOS while keeping pinch zoom; never disable zoom with `user-scalable=no` or `maximum-scale`.
- Set `-webkit-tap-highlight-color: transparent` only when every control has its own visible `:active` and `:focus-visible` states.
- Hide the scrollbar and its gutter on touch screens with `scrollbar-width: none` and `scrollbar-gutter: auto` inside `@media (pointer: coarse)`.
- Keep content clear of the soft fade that iOS draws under a translucent status bar: pad the top of every screen by `env(safe-area-inset-top)` plus extra space, not only full-screen views.
- Pin a full-screen view with `position: fixed` and `inset: 0` instead of sizing it with viewport units, which fall short of the visible area in the installed app on iPhone, and pad each safe area only once.
- Scope standalone-only styles with `@media (display-mode: standalone)` and check full-height layouts on a device. In standalone mode on iPhone, the layout viewport and viewport units are shorter than the screen by the top safe area, so extend a fixed full-screen view with `inset-block-end: calc(env(safe-area-inset-top) * -1)` there.
- Give `body` the background of an open full-screen view, for example with `body:has()`, because the view can stop above the bottom safe area.

## Storage and notifications

- On iOS, a Home Screen app has storage separate from Safari, so data saved in a tab does not carry over.
- Call `navigator.storage.persist()` once after the first meaningful save. WebKit grants it by heuristics that favour Home Screen apps, so never rely on it, and handle `QuotaExceededError`.
- Offer export and import for device-only data that users would miss.
- Store data and exports with a schema version. When stored data has an unknown version or cannot be read, keep a backup copy before starting afresh, and stop writing while no backup could be made.
- Use IndexedDB for large or structured data.
- Add Web Push and the Badging API only when the task requires them. On iOS and iPadOS, both work only in Home Screen web apps, since 16.4.
- Request notification permission only from a user gesture, prefer Declarative Web Push where Safari supports it and feature-detect `setAppBadge()`.

## Verification

- Test the production build over HTTPS on a host where the worker registers, such as a staging site or a tunnel, not on a development host that skips registration.
- Check the manifest, the worker and the caches in the DevTools Application panel; Lighthouse no longer audits PWAs.
- Verify offline start after the first load, an update across two consecutive builds and the first install, which must not show the update notice.
- Test on a real iPhone, or in the iOS Simulator of Xcode, added to the Home Screen, inspecting the app and its worker through Safari's Develop menu.
- Verify that a running activity survives the app being ended in the background and an accepted update.
