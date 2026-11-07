/**
 * @template T
 * @typedef {{
 *   get: () => T,
 *   set: (value: T) => boolean,
 *   watch: (target?: EventTarget) => void
 * }} Store
 */

/**
 * Keep one value in localStorage under a key, wrapped with a schema version. A stored value with another version or
 * one that cannot be read is backed up under `<key>:backup` before the empty value applies, and when even the backup
 * fails, the store never writes over it for the rest of the session.
 *
 * @template T
 * @param {string} key Storage key.
 * @param {{ version: number, read: (data: unknown) => T, empty: () => T }} options Schema version, a function that takes the valid parts of stored data, and the value without stored data.
 * @returns {Store<T>} The store.
 */
export const createStore = (key, { version, read, empty }) => {
  /** @type {T | null} */
  let value = null;
  let locked = false;

  const load = () => {
    let raw = null;

    try {
      raw = localStorage.getItem(key);

      if (raw === null) return empty();

      const stored = JSON.parse(raw);

      if (stored?.version === version) return read(stored.data);
    } catch (error) {
      console.warn(`The stored ${key} could not be read.`, error);
    }

    try {
      localStorage.setItem(`${key}:backup`, raw);
    } catch (error) {
      locked = true;
      console.warn(`The unreadable ${key} could not be backed up.`, error);
    }

    return empty();
  };

  return {
    /** @returns {T} The value, read from storage on first use. */
    get() {
      value ??= load();

      return value;
    },

    /**
     * @param {T} next The new value.
     * @returns {boolean} Whether it reached storage; when it did not, it lasts until the app closes.
     */
    set(next) {
      value = next;

      if (locked) return false;

      try {
        localStorage.setItem(key, JSON.stringify({ version, data: next }));
        return true;
      } catch (error) {
        console.warn(`The ${key} could not be saved.`, error);
        return false;
      }
    },

    /**
     * Read the value again when another window of the app, such as the installed app next to a browser tab, changes
     * it, so that the next change here does not overwrite that one.
     *
     * @param {EventTarget} [target] Where `storage` events arrive: the window.
     * @returns {void}
     */
    watch(target = window) {
      target.addEventListener('storage', (/** @type {StorageEvent} */ event) => {
        // The key is null when the whole store was cleared.
        if (event.key === null || event.key === key) value = null;
      });
    }
  };
};
