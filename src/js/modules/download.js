/** How long the address of a download stays valid: Safari starts reading the file after the click, not during it. */
const REVOKE_DELAY = 10_000;

/**
 * Offer data to the user as a JSON file.
 *
 * @param {unknown} data Data to write.
 * @param {string} fileName Name the browser suggests for the file.
 * @returns {void}
 */
export const saveJson = (data, fileName) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = fileName;
  link.click();
  // Revoking at once makes Safari fail with "WebKitBlobResource error 1".
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY);
};
