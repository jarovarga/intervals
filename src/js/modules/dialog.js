/** @type {HTMLDialogElement | null} */
let dialog = null;

/**
 * @param {string} [selector] Selector of the confirmation dialog.
 * @returns {void}
 */
export const init = (selector = '[data-dialog]') => {
  dialog = document.querySelector(selector);
};

/**
 * Ask the user to confirm an action in the modal dialog. Escape and Cancel both answer no.
 *
 * @param {{ title: string, text: string, confirmLabel: string }} question What to ask.
 * @returns {Promise<boolean>} True when the user confirmed.
 */
export const ask = ({ title, text, confirmLabel }) =>
  new Promise((resolve) => {
    dialog.querySelector('[data-dialog-title]').textContent = title;
    dialog.querySelector('[data-dialog-text]').textContent = text;
    dialog.querySelector('[data-dialog-confirm]').textContent = confirmLabel;
    dialog.returnValue = '';
    // Going back while the dialog is open leaves its screen, so it answers no.
    const dismiss = () => dialog.close();

    window.addEventListener('popstate', dismiss, { once: true });
    dialog.addEventListener(
      'close',
      () => {
        window.removeEventListener('popstate', dismiss);
        resolve(dialog.returnValue === 'confirm');
      },
      { once: true }
    );
    dialog.showModal();
  });
