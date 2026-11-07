const originals = new Map();

/**
 * Replace a global for the length of a test. Call `restoreGlobals` after the test to put every original back.
 *
 * @param {string} name Name of the global.
 * @param {unknown} value What it holds meanwhile.
 * @returns {void}
 */
export const setGlobal = (name, value) => {
  if (!originals.has(name)) originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));

  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
};

/**
 * Put back the globals that `setGlobal` replaced, removing the ones that did not exist before.
 *
 * @returns {void}
 */
export const restoreGlobals = () => {
  originals.forEach((descriptor, name) => {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      delete globalThis[name];
    }
  });
  originals.clear();
};

/**
 * Collect what the code under test writes with `console.warn`, so that it neither clutters the output nor goes unseen.
 *
 * @param {import('node:test').TestContext} context Test that owns the collecting.
 * @returns {string[]} The first argument of every warning.
 */
export const collectWarnings = (context) => {
  const warnings = [];
  const original = console.warn;

  console.warn = (...args) => warnings.push(String(args[0]));
  context.after(() => {
    console.warn = original;
  });

  return warnings;
};
