import { createHash } from 'node:crypto';
import { watch } from 'node:fs';
import { copyFile, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { build, context } from 'esbuild';
import { minify } from 'html-minifier-terser';

/** Absolute path to the project root. */
const ROOT = dirname(fileURLToPath(import.meta.url));

/**
 * Print an error with its stack trace when available.
 *
 * @param {unknown} error Error raised during a build or watch operation.
 * @returns {void}
 */
const reportError = (error) => {
  const message = error instanceof Error ? error.stack : String(error);
  process.stderr.write(`${message}\n`);
};

/**
 * Report a watch step in the format of the esbuild watch log.
 *
 * @param {string} message Step description.
 * @returns {void}
 */
const reportWatch = (message) => {
  process.stdout.write(`[watch] ${message}\n`);
};

/** Source and output paths used by the build pipeline. */
const paths = {
  html: {
    source: resolve(ROOT, 'src/index.html'),
    output: resolve(ROOT, 'public/index.html')
  },
  css: {
    source: resolve(ROOT, 'src/css/app.css'),
    output: resolve(ROOT, 'public/assets/css/app.min.css')
  },
  js: {
    source: resolve(ROOT, 'src/js/app.js'),
    output: resolve(ROOT, 'public/assets/js/app.min.js')
  },
  manifest: {
    source: resolve(ROOT, 'src/app.webmanifest'),
    output: resolve(ROOT, 'public/app.webmanifest')
  },
  worker: {
    source: resolve(ROOT, 'src/service-worker.js'),
    output: resolve(ROOT, 'public/service-worker.js')
  },
  img: {
    source: resolve(ROOT, 'src/img'),
    output: resolve(ROOT, 'public/assets/img')
  },
  fonts: {
    source: resolve(ROOT, 'src/fonts'),
    output: resolve(ROOT, 'public/assets/fonts')
  }
};

/** Static asset directories copied to the public directory unchanged. */
const copied = [paths.img, paths.fonts];

/** @type {{ css: import("esbuild").BuildOptions, js: import("esbuild").BuildOptions }} */
const options = {
  css: {
    entryPoints: [paths.css.source],
    outfile: paths.css.output,
    bundle: true,
    minify: true,
    logLevel: 'info',
    external: ['../fonts/*', '../img/*']
  },
  js: {
    entryPoints: [paths.js.source],
    outfile: paths.js.output,
    bundle: true,
    minify: true,
    format: 'esm',
    logLevel: 'info'
  }
};

/**
 * Append a content hash to the bundle URLs so that HTTP caches fetch changed files while unchanged ones stay cached.
 *
 * @param {string} source HTML source referencing the bundles.
 * @returns {Promise<string>} HTML with versioned bundle URLs.
 */
async function versionAssets(source) {
  const bundles = [
    { url: './assets/css/app.min.css', file: paths.css.output },
    { url: './assets/js/app.min.js', file: paths.js.output }
  ];
  let versioned = source;

  for (const { url, file } of bundles) {
    if (!versioned.includes(url)) {
      throw new Error(`Bundle URL not found in HTML: ${url}`);
    }

    /** @type {{ digest(encoding: string): string }} */
    const hash = createHash('sha256').update(await readFile(file));

    versioned = versioned.replace(url, `${url}?v=${hash.digest('hex').slice(0, 8)}`);
  }

  return versioned;
}

/**
 * Minify HTML and write it to the public output directory.
 *
 * @param {string} source HTML source to minify.
 * @param {boolean} [version] Whether to version the bundle URLs.
 * @returns {Promise<void>}
 */
async function writeHtml(source, version = false) {
  const html = version ? await versionAssets(source) : source;
  const output = await minify(html, {
    collapseWhitespace: true,
    removeComments: true
  });

  await mkdir(dirname(paths.html.output), { recursive: true });
  await writeFile(paths.html.output, output);
}

/** Build the HTML entry point with versioned bundle URLs. */
async function buildHtml() {
  const source = await readFile(paths.html.source, 'utf8');
  await writeHtml(source, true);
}

/** Build the CSS bundle. */
async function buildCss() {
  await build(options.css);
}

/** Build the JavaScript bundle. */
async function buildJs() {
  await build(options.js);
}

/**
 * Replace an output directory with a copy of its source, so that deleted or renamed files are not deployed.
 *
 * @param {{ source: string, output: string }} directory Source and output paths.
 * @returns {Promise<void>}
 */
async function copyDirectory({ source, output }) {
  await rm(output, { recursive: true, force: true });
  // Skip the placeholders that keep empty source directories in Git.
  await cp(source, output, { recursive: true, filter: (path) => basename(path) !== '.gitkeep' });
}

/** Copy the images and fonts to the public directory. */
async function copyAssets() {
  await Promise.all(copied.map(copyDirectory));
}

/** Copy the web app manifest to the public directory. */
async function copyManifest() {
  await mkdir(dirname(paths.manifest.output), { recursive: true });
  await copyFile(paths.manifest.source, paths.manifest.output);
}

/**
 * List the files below a directory, depth first.
 *
 * @param {string} directory Absolute directory path.
 * @returns {Promise<string[]>} Absolute file paths in a stable order.
 */
async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

/**
 * Write the service worker with the files to precache and a cache name that changes with their content, so that the
 * browser replaces the old cache after every deployment.
 *
 * @returns {Promise<void>}
 */
async function buildWorker() {
  const publicDirectory = resolve(ROOT, 'public');
  const files = [
    paths.html.output,
    paths.manifest.output,
    paths.css.output,
    paths.js.output,
    ...(await listFiles(paths.img.output)),
    ...(await listFiles(paths.fonts.output))
  ];
  const hash = createHash('sha256');
  const urls = [];

  for (const file of files) {
    const url = relative(publicDirectory, file).split(sep).join('/');

    hash.update(url).update(await readFile(file));
    urls.push(`./${url}`);
  }

  const source = await readFile(paths.worker.source, 'utf8');
  const output = source
    .replace('__BUILD_HASH__', hash.digest('hex').slice(0, 8))
    .replace('__PRECACHE_PATHS__', JSON.stringify(urls));

  await writeFile(paths.worker.output, output);
}

/**
 * Build the bundles, copy the images, fonts and manifest in parallel, then the HTML that hashes the bundles and the
 * service worker that precaches everything.
 */
async function buildAll() {
  await Promise.all([buildCss(), buildJs(), copyAssets(), copyManifest()]);
  await buildHtml();
  await buildWorker();
}

/**
 * Start CSS, JavaScript, and HTML watchers and copy the images and fonts again when they change. The service worker
 * is not built in watch mode, so that no stale cache hides changes.
 */
async function watchAll() {
  let htmlSource = await readFile(paths.html.source, 'utf8');
  await writeHtml(htmlSource);

  // Source maps are for debugging in the browser only, so the production build does not write them.
  const [css, js] = await Promise.all([
    context({ ...options.css, sourcemap: 'linked' }),
    context({ ...options.js, sourcemap: 'linked' })
  ]);

  try {
    await Promise.all([css.watch(), js.watch(), copyAssets(), copyManifest()]);
  } catch (error) {
    // Undisposed contexts keep watching, so the process would not exit.
    await Promise.all([css.dispose(), js.dispose()]);
    throw error;
  }

  const watchers = copied.map((directory) => {
    const state = { timer: undefined, copy: Promise.resolve() };
    const watcher = watch(directory.source, { recursive: true }, () => {
      clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        // Queue the copy so that it never removes the output while the previous one still writes.
        state.copy = state.copy
          .then(async () => {
            reportWatch(`copy started (change: "${relative(ROOT, directory.source)}")`);
            await copyDirectory(directory);
            reportWatch('copy finished');
          })
          .catch(reportError);
      }, 50);
    });

    return { state, watcher };
  });

  let htmlBuildRunning = false;

  const pollHtml = async () => {
    if (htmlBuildRunning) return;

    try {
      const source = await readFile(paths.html.source, 'utf8');
      if (source === htmlSource) return;

      htmlBuildRunning = true;
      htmlSource = source;
      reportWatch(`build started (change: "${relative(ROOT, paths.html.source)}")`);
      await writeHtml(source);
      reportWatch('build finished');
    } catch (error) {
      reportError(error);
    } finally {
      htmlBuildRunning = false;
    }
  };

  const html = setInterval(() => {
    pollHtml().catch(reportError);
  }, 250);

  const stop = () => {
    clearInterval(html);
    watchers.forEach(({ state, watcher }) => {
      clearTimeout(state.timer);
      watcher.close();
    });
    Promise.all([css.dispose(), js.dispose()]).catch(reportError);
  };

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

const watchMode = process.argv.includes('--watch');

try {
  if (watchMode) {
    await watchAll();
  } else {
    await buildAll();
  }
} catch (error) {
  reportError(error);
  process.exitCode = 1;
}
