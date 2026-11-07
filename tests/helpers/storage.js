/**
 * A localStorage that keeps its items in a map and can be made to refuse writes.
 *
 * @param {Record<string, string>} [items] What it holds to begin with.
 * @returns {{ items: Map<string, string>, full: boolean, getItem: Function, setItem: Function, removeItem: Function }} The store.
 */
export const fakeStorage = (items = {}) => {
  const store = {
    items: new Map(Object.entries(items)),
    full: false,
    getItem: (key) => store.items.get(key) ?? null,
    setItem: (key, value) => {
      if (store.full) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');

      store.items.set(key, String(value));
    },
    removeItem: (key) => {
      store.items.delete(key);
    }
  };

  return store;
};

/**
 * @param {string | null} key Key that changed, or null when the whole store was cleared.
 * @returns {Event} A `storage` event as another window of the app would cause it.
 */
export const storageEvent = (key) => Object.assign(new Event('storage'), { key });
