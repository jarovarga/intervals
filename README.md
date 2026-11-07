# PWA kit

Starter kit for installable, offline-capable web apps: a web app manifest, a service worker that precaches the build, update and install offers, and a settings section, in plain HTML, layered CSS and ES modules. It is built with esbuild and checked with Stylelint, ESLint, HTML-validate and Prettier.

## Features

- A web app manifest and icons, including a maskable icon, with the document head tags for iOS
- A service worker whose cache name and precache list come from a content hash of the build; a new version waits until the visitor accepts it
- An update notice with a Reload button, a check for updates when the app returns to the foreground and a manual check in the settings
- An Add to Home Screen explanation for Safari on iOS and iPadOS, which can be shown again from the settings
- Settings with the version of the app, set by the build from `package.json`, and a Buy me a coffee link
- Safe-area padding for the translucent iOS status bar and the home indicator
- Deployment to GitHub Pages from GitHub Actions

## Requirements

- Node.js `^22.22.0` or `>=24.8.0` (`.nvmrc` pins 24) and npm

## Getting started

```bash
npm install
```

```bash
npm run build
```

The build writes the deployable site to `public/`. The app needs a secure context: `localhost` and HTTPS work, but a plain `http://` address on the local network does not. The service worker does not register on `localhost`, `127.0.0.1` and `[::1]`, and removes an earlier one with its caches, so that development always loads the current files. To test it, serve the production build over HTTPS, for example from a staging site or a tunnel.

## Start a new project

Replace the placeholders before the first deployment:

- `src/index.html`: `<title>`, `description`, `theme-color`, the canonical URL, the `apple-mobile-web-app-title` and the content of the `home` section
- `src/app.webmanifest`: `name`, `short_name`, `description`, `theme_color` and `background_color`; keep `id` unchanged after the first release
- `src/service-worker.js`: the cache prefix `pwa-kit-` in two places, and the offline message
- `src/js/modules/install.js`: the storage key `pwa-kit:install-dismissed`
- `src/css/tokens.css`: the design values
- `src/img/`: `logo.svg` and the icons `icon.svg`, `icon-96x96.png`, `icon-180x180.png` with an opaque background, `icon-192x192.png`, `icon-512x512.png` and `icon-maskable-512x512.png`, whose content stays inside the central safe zone. The icons in the kit are blank placeholders.
- the Ko-fi link in the settings, or remove it

## Commands

| Command                | Description                                                    |
| ---------------------- | -------------------------------------------------------------- |
| `npm run build`        | Build `public/` from `src/`                                    |
| `npm run watch`        | Build, then rebuild on every change in `src/`                  |
| `npm test`             | Run the unit tests in `tests/` with the Node.js test runner    |
| `npm run format`       | Format the project with Prettier                               |
| `npm run format:check` | Check formatting with Prettier without writing changes         |
| `npm run fix:css`      | Fix Stylelint issues in `src/css/` automatically               |
| `npm run lint:css`     | Lint `src/css/` with Stylelint                                 |
| `npm run lint:js`      | Lint the scripts, the service worker and the tests with ESLint |
| `npm run lint:html`    | Validate `src/**/*.html` with HTML-validate                    |
| `npm run lint`         | Run all linters: `lint:css`, `lint:js` and `lint:html`         |

All linters treat warnings as errors. Prettier ignores `*.html`, `*.md` and `public/`.

## Build

`build.js` uses esbuild and html-minifier-terser to produce:

- `public/assets/css/app.min.css`: `src/css/app.css` with its imports bundled and minified
- `public/assets/fonts/`: copy of `src/fonts/`
- `public/assets/img/`: copy of `src/img/`
- `public/assets/js/app.min.js`: `src/js/app.js` with its modules bundled and minified
- `public/index.html`: minified `src/index.html`, with the version from `package.json` in place of `__APP_VERSION__`
- `public/app.webmanifest`: the web app manifest
- `public/service-worker.js`: the service worker, with a content hash and the list of files to precache filled in

The generated files are ignored by Git; never edit them directly. `public/robots.txt` is a tracked source file that the build does not overwrite. Raise `version` in `package.json` only for a new feature or another significant change.

## Deployment

`.github/workflows/pages.yml` audits, lints, tests and builds the site on every push to `main` and publishes `public/` through GitHub Pages. In the repository settings, set Pages to build and deploy from **GitHub Actions**. The site is then served from `https://<user>.github.io/<repository>/`. `.github/workflows/ci.yml` runs the same checks on pushes to `dev` and on pull requests to `main`. Both pin their actions to commit hashes and install without running package scripts. `.github/dependabot.yml` proposes weekly updates of npm packages and GitHub Actions after a seven-day cooldown.

## Known limitations

On iOS, the app may flash white for a moment when opened from the Home Screen. iOS ignores `background_color` in the web app manifest and shows its own splash screen unless `apple-touch-startup-image` supplies one for each device's exact resolution; the kit does not ship those images, because the list would need constant upkeep and WebKit may still flash white with one (see [WebKit bug 215479](https://bugs.webkit.org/show_bug.cgi?id=215479)).

## Structure

```text
.claude/                    Claude Code instructions, rules and settings
.github/workflows/          CI and deployment to GitHub Pages
src/
├── css/
│   ├── blocks/             Reusable BEM blocks (layer block)
│   ├── helpers/            Reusable helpers such as icons (layer helper)
│   ├── modules/            CSS for standalone functional modules (layer module)
│   ├── segments/           Styles for individual page parts (layer segment)
│   ├── utils/              Accessibility rules and global states (layer util)
│   ├── app.css             Layer order, imports and @font-face
│   ├── base.css            Global document styles and shared keyframes (layer base)
│   ├── reset.css           Minimal browser normalisation (layer reset)
│   └── tokens.css          Global design values
├── fonts/
├── img/
├── js/
│   ├── modules/            One behaviour per kebab-case module
│   └── app.js              Entry point that wires all behaviour
├── app.webmanifest         Web app manifest
├── index.html              Page: header and main with one section per page part
└── service-worker.js       Offline cache and update handling
tests/                      Unit tests
```

The cascade layers are ordered by ascending priority: `reset`, `base`, `helper`, `block`, `module`, `segment`, `util`. The root files start the cascade and `utils/` ends it.

## Licence

ISC, see `LICENSE`.
