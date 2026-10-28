# Intervals

PWA interval timer for circuit workouts: build your own routines, then train with a full-screen timer, even offline.

Open it at [jarovarga.github.io/intervals](https://jarovarga.github.io/intervals/) and add it to the Home Screen to use it like an app.

## Features

- Workouts with a name, a colour, any number of exercises with their own time, a get-ready countdown, rest between exercises, rounds and a cooldown between rounds
- A total time that updates while you edit
- A full-screen timer with a colour for every phase, the next step, progress through the exercises and the round
- Sound cues for the start of an exercise, rest, a new round and the end, which can be muted
- The screen stays on while a workout runs
- Installable and available offline, because a service worker caches the whole app and offers a reload when a new version is ready
- Workouts are stored in the browser on your device; nothing is sent anywhere

Plain HTML, layered CSS and ES modules, built with esbuild and checked with Stylelint, ESLint, HTML-validate and Prettier.

## Requirements

- Node.js `^22.22.0` or `>=24.8.0` (`.nvmrc` pins 24) and npm

## Getting started

```bash
npm install
```

```bash
npm run build
```

The build writes the deployable site to `public/`. To try it locally, serve that folder with any static server.

## Commands

| Command                | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `npm run build`        | Build `public/` from `src/`                                       |
| `npm run watch`        | Build with source maps, then rebuild on every change in `src/`    |
| `npm test`             | Run the unit tests in `tests/` with the Node.js test runner       |
| `npm run format`       | Format the project with Prettier                                  |
| `npm run format:check` | Check formatting with Prettier without writing changes            |
| `npm run fix:css`      | Fix Stylelint issues in `src/css/` automatically                  |
| `npm run lint:css`     | Lint `src/css/` with Stylelint                                    |
| `npm run lint:js`      | Lint `src/js/` and the configuration scripts with ESLint          |
| `npm run lint:html`    | Validate `src/**/*.html` with HTML-validate                       |
| `npm run lint`         | Run all linters: `lint:css`, `lint:js` and `lint:html`            |

All linters treat warnings as errors. Prettier ignores `*.html`, `*.md` and `public/`.

## Build

`build.js` uses esbuild and html-minifier-terser to produce:

- `public/assets/css/app.min.css`: `src/css/app.css` with its imports bundled and minified
- `public/assets/fonts/`: copy of `src/fonts/`
- `public/assets/img/`: copy of `src/img/`
- `public/assets/js/app.min.js`: `src/js/app.js` with its modules bundled and minified
- `public/index.html`: minified `src/index.html`
- `public/app.webmanifest`: the web app manifest
- `public/service-worker.js`: the service worker, with a content hash and the list of files to precache filled in

The generated files are ignored by Git; never edit them directly. `public/robots.txt` is a tracked source file that the build does not overwrite.

## Deployment

`.github/workflows/pages.yml` lints and builds the site on every push to `main` and publishes `public/` through GitHub Pages. In the repository settings, set Pages to build and deploy from **GitHub Actions**. The site is then served from `https://<user>.github.io/<repository>/`.

## Structure

```text
.github/workflows/          Deployment to GitHub Pages
src/
├── css/
│   ├── blocks/             Reusable BEM blocks (layer block)
│   ├── helpers/            Reusable helpers such as icons (layer helper)
│   ├── modules/            CSS for standalone functional modules (layer module)
│   ├── segments/           Styles for individual page parts (layer segment)
│   ├── utils/              Accessibility rules and global states (layer util)
│   ├── app.css             Layer order, imports and @font-face
│   ├── base.css            Global document styles (layer base)
│   ├── reset.css           Minimal browser normalisation (layer reset)
│   └── tokens.css          Global design values
├── fonts/
├── img/
├── js/
│   ├── modules/            One behaviour per kebab-case module
│   └── app.js              Entry point that wires all behaviour
├── app.webmanifest         Web app manifest
├── index.html              Page: header, main with one section per page part, footer
└── service-worker.js       Offline cache and update handling
tests/                      Unit tests
```

The cascade layers are ordered by ascending priority: `reset`, `base`, `helper`, `block`, `module`, `segment`, `util`. The root files start the cascade and `utils/` ends it.

## Licence

ISC, see `LICENSE`.
