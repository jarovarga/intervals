import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { createStore } from '../src/js/modules/store.js';
import { collectWarnings, restoreGlobals, setGlobal } from './helpers/globals.js';
import { fakeStorage, storageEvent } from './helpers/storage.js';

const KEY = 'intervals:test';
const BACKUP_KEY = `${KEY}:backup`;

/**
 * @param {Record<string, string>} [items] What the storage holds to begin with.
 * @returns {{ storage: ReturnType<typeof fakeStorage>, store: ReturnType<typeof createStore> }} A store of a list of numbers.
 */
const setUp = (items) => {
  const storage = fakeStorage(items);

  setGlobal('localStorage', storage);

  return {
    storage,
    store: createStore(KEY, {
      version: 2,
      read: (data) => (Array.isArray(data) ? data.filter(Number.isInteger) : []),
      empty: () => []
    })
  };
};

afterEach(() => restoreGlobals());

test('without stored data the empty value applies', () => {
  assert.deepEqual(setUp().store.get(), []);
});

test('a value is stored with its schema version and read back through the reader', () => {
  const { storage, store } = setUp({ [KEY]: JSON.stringify({ version: 2, data: [1, 'x', 2] }) });

  assert.deepEqual(store.get(), [1, 2]);
  assert.equal(store.set([3]), true);
  assert.deepEqual(JSON.parse(storage.items.get(KEY)), { version: 2, data: [3] });
});

test('unreadable data or data of another version is backed up before the empty value applies', (context) => {
  collectWarnings(context);

  for (const raw of ['{not json', JSON.stringify({ version: 1, data: [5] })]) {
    const { storage, store } = setUp({ [KEY]: raw });

    assert.deepEqual(store.get(), []);
    assert.equal(storage.items.get(BACKUP_KEY), raw);
  }
});

test('a value that cannot be stored lasts until the app closes', (context) => {
  const warnings = collectWarnings(context);
  const { storage, store } = setUp();

  storage.full = true;

  assert.equal(store.set([7]), false);
  assert.deepEqual(store.get(), [7]);
  assert.equal(warnings.length, 1);
});

test('when unreadable data cannot be backed up, nothing is written over it', (context) => {
  collectWarnings(context);

  const { storage, store } = setUp({ [KEY]: '{not json' });

  storage.full = true;
  store.get();
  storage.full = false;

  assert.equal(store.set([1]), false);
  assert.equal(storage.items.get(KEY), '{not json');
});

test('a change from another window is read again, and other keys are ignored', () => {
  const { storage, store } = setUp();
  const page = new EventTarget();

  store.watch(page);
  store.get();
  storage.items.set(KEY, JSON.stringify({ version: 2, data: [9] }));
  page.dispatchEvent(storageEvent('intervals:other'));

  assert.deepEqual(store.get(), []);

  page.dispatchEvent(storageEvent(KEY));

  assert.deepEqual(store.get(), [9]);
});
