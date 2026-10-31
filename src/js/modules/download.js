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

  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
};
