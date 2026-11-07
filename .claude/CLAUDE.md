# Progressive web app

See @../README.md for the commands, build, deployment and project structure. Use no framework and run npm on the host.

## Project structure

- Preserve the existing structure. For a new project, keep sources in `src/` and the deployed output in `public/`: `src/index.html`, CSS in `src/css/`, JavaScript in `src/js/` with the entry `app.js` and behaviour modules in `src/js/modules/`, and static assets in `src/fonts/` and `src/img/`.
- Never edit the generated `public/index.html`, `public/app.webmanifest`, `public/service-worker.js` and `public/assets/`. CSS `@import` is acceptable in development because the build concatenates it for production.

## CSS

- Keep the CSS in `src/css/`, one file per responsibility, each imported by `app.css` into its cascade layer. Keep the start of the cascade in the root files and everything else in folders named after their layer in the plural:
  - `blocks/<block>.css`: reusable BEM blocks, with their elements and modifiers in the same block file, such as `.card__title` in `blocks/card.css` (layer `block`)
  - `helpers/<helper>.css`: reusable attribute helpers that blocks may adapt, such as the `[data-icon]` icons in `helpers/icons.css` (layer `helper`)
  - `modules/<module>.css`: CSS for standalone functional modules, such as a slider, counter or scroll effect; reusability is not required (layer `module`)
  - `segments/<segment>.css`: styles for individual page parts: the `header` and each `section` in `main`; import a frame shared by the sections first (layer `segment`)
  - `utils/a11y.css`: focus styles, the `.visually-hidden` class and the global reduced-motion rule (layer `util`, so that they win over every other layer)
  - `utils/states.css`: global states, imported last (layer `util`)
  - `app.css`: the layer order in ascending priority `reset`, `base`, `helper`, `block`, `module`, `segment`, `util`, then the imports and the global `@font-face` rules
  - `base.css`: global document styles, including `.container` and the keyframes shared by several files (layer `base`)
  - `reset.css`: browser normalisation (layer `reset`)
  - `tokens.css`: global design values
- Place new styles in the first matching location: rules that must win over every other layer in `utils/`, global rules in a root file, adaptable helpers in `helpers/`, page parts in `segments/`, standalone features and effects in `modules/` and other reusable blocks in `blocks/`.
- Import only existing files.

## HTML

- Keep the page in `src/index.html`: `header` with the navigation and `main` with one `section` per page part. Give each section the navigation links to a kebab-case `id` and link to it with a fragment; use `id="app"` on `body` as the top target.
- In `head` set `description`, the canonical link and the SVG and 96 px PNG icons, preload only the fonts the app uses early and load `app.min.css`.
- Load `app.min.js` at the end of `body`.

## JavaScript

- Keep one behaviour per module and export it as a named arrow function.
