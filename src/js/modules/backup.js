import * as library from './library.js';
import * as preferences from './preferences.js';

/** Name and schema version that mark a file as an export of this app. */
const APP = 'intervals';
const VERSION = 1;

/** Largest export file an import accepts, in bytes. */
export const MAX_BYTES = 1024 * 1024;

/**
 * @typedef {{ app: string, version: number, exportedAt: string, preferences: object, workouts: unknown[], completions: unknown[] }} Backup
 */

/**
 * @param {Date} [now] Time of the export.
 * @returns {Backup} Everything the app keeps on this device: the preferences, the workouts and the log.
 */
export const createBackup = (now = new Date()) => ({
  app: APP,
  version: VERSION,
  exportedAt: now.toISOString(),
  preferences: preferences.get(),
  ...library.exportData()
});

/**
 * @param {Date} [now] Time of the export.
 * @returns {string} File name with the date of the export, such as `intervals-2026-11-07.json`.
 */
export const fileName = (now = new Date()) => `${APP}-${now.toISOString().slice(0, 10)}.json`;

/**
 * @param {string} text Contents of a file.
 * @returns {Backup | null} The export, or null when the text is not an export of this app in a known version.
 */
export const readBackup = (text) => {
  try {
    const data = JSON.parse(text);

    return data?.app === APP && data.version === VERSION ? data : null;
  } catch {
    return null;
  }
};

/**
 * Take over an export: its preferences replace the current ones, because there is one value for each, and its
 * workouts and finished workouts are added to those already saved.
 *
 * @param {Backup} backup A read export.
 * @returns {{ workouts: number, completions: number, saved: boolean }} How many were added and whether everything reached storage.
 */
export const restore = (backup) => {
  const hasPreferences = backup.preferences !== null && typeof backup.preferences === 'object';
  const preferencesSaved = !hasPreferences || preferences.update(backup.preferences);
  const added = library.importData(backup);

  return { ...added, saved: added.saved && preferencesSaved };
};
