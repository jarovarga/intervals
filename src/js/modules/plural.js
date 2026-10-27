const NO_BREAK_SPACE = '\u00a0';
const rules = new Intl.PluralRules('en-GB');

/**
 * Write a count with its unit, kept together on one line.
 *
 * @param {number} amount How many there are.
 * @param {string} one Unit for exactly one.
 * @param {string} other Unit for any other amount.
 * @returns {string} For example `1 round` or `8 exercises`.
 */
export const count = (amount, one, other) =>
  `${amount}${NO_BREAK_SPACE}${rules.select(amount) === 'one' ? one : other}`;
