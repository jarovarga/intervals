/** @type {HTMLDialogElement | null} */
let dialog = null;

/**
 * @param {string} [selector] Selector of the confirmation dialog.
 * @returns {void}
 */
export const init = (selector = '[data-dialog="confirm"]') => {
  dialog = document.querySelector(selector);
};

/**
 * Ask the user to confirm an action in the modal dialog. Escape and Cancel both answer no.
 *
 * @param {{ title: string, text: string, confirmLabel: string, danger?: boolean }} question What to ask; `danger`, on by
 *   default, styles the confirmation as a destructive action.
 * @returns {Promise<boolean>} True when the user confirmed.
 */
export const ask = ({ title, text, confirmLabel, danger = true }) =>
  new Promise((resolve) => {
    const confirm = dialog.querySelector('[data-confirm="dialog"]');

    dialog.querySelector('[data-title="dialog"]').textContent = title;
    dialog.querySelector('[data-text="dialog"]').textContent = text;
    confirm.textContent = confirmLabel;
    confirm.classList.toggle('button--danger', danger);
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
