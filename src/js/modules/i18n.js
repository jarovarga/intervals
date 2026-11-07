import { en } from '../locales/en.js';
import { sk } from '../locales/sk.js';

/** Languages the app is written in; the first one is the fallback. */
export const LANGUAGES = ['en', 'sk'];

const DEFAULT_LANGUAGE = LANGUAGES[0];
const NO_BREAK_SPACE = ' ';

/** BCP 47 tag of each language. English is the British one, which starts the week on Monday. */
const LOCALES = { en: 'en-GB', sk: 'sk' };
const MESSAGES = { en, sk };

let language = DEFAULT_LANGUAGE;
let rules = new Intl.PluralRules(LOCALES[language]);

/**
 * @param {unknown} value Any value.
 * @returns {boolean} Whether it is the code of a language of the app.
 */
export const isLanguage = (value) => LANGUAGES.includes(/** @type {string} */ (value));

/**
 * @param {unknown} chosen The language the user chose, if any.
 * @returns {string} The chosen language, or English when none was chosen.
 */
export const resolve = (chosen) => (isLanguage(chosen) ? /** @type {string} */ (chosen) : DEFAULT_LANGUAGE);

/** @returns {string} Code of the language in use. */
export const getLanguage = () => language;

/** @returns {string} BCP 47 tag of the language in use, for `Intl` and the `lang` attribute. */
export const getLocale = () => LOCALES[language];

/**
 * @param {string} key Key of a text.
 * @returns {unknown} The text in the language in use, or in English where it is missing.
 */
const lookup = (key) => MESSAGES[language][key] ?? MESSAGES[DEFAULT_LANGUAGE][key];

/**
 * @param {string} key Key of a text.
 * @param {Record<string, string | number>} [params] Values for the `{name}` places of the text.
 * @returns {string} The text in the language in use; the key itself where no language has it.
 */
export const t = (key, params = {}) => {
  const text = lookup(key);

  if (typeof text !== 'string') return key;

  return text.replaceAll(/\{(\w+)\}/g, (place, name) => String(params[name] ?? place));
};

/**
 * Write a count with its unit, kept together on one line.
 *
 * @param {string} key Key of a text with a form for each plural category.
 * @param {number} amount How many there are.
 * @returns {string} For example `1 round` or `8 exercises`.
 */
export const count = (key, amount) => {
  const forms = /** @type {Record<string, string>} */ (lookup(key));

  return `${amount}${NO_BREAK_SPACE}${forms?.[rules.select(amount)] ?? forms?.other ?? key}`;
};

/**
 * @param {string[]} items Texts to list.
 * @returns {string} The texts joined the way the language does, such as `a, b and c`.
 */
export const list = (items) => new Intl.ListFormat(getLocale(), { style: 'long', type: 'conjunction' }).format(items);

/**
 * Write the texts of the static markup: `data-i18n` sets the text of an element and `data-i18n-attr` sets attributes,
 * as pairs of `attribute:key` separated by spaces.
 *
 * @param {ParentNode} [root] Part of the page to write.
 * @returns {void}
 */
export const localise = (root = document) => {
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(/** @type {HTMLElement} */ (element).dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((element) => {
    /** @type {HTMLElement} */ (element).dataset.i18nAttr.split(' ').forEach((pair) => {
      const [attribute, key] = pair.split(':');

      element.setAttribute(attribute, t(key));
    });
  });
};

/**
 * Choose the language the texts are written in.
 *
 * @param {string} next Code of the language; an unknown one is ignored.
 * @returns {void}
 */
export const setLanguage = (next) => {
  if (!isLanguage(next)) return;

  language = next;
  rules = new Intl.PluralRules(getLocale());
};

/**
 * Switch the page to a language: set its `lang` and write the static markup again, including the templates. Screens
 * that build their texts when they show pick the language up the next time they show.
 *
 * @param {string} next Code of the language; an unknown one is ignored.
 * @returns {void}
 */
export const useLanguage = (next) => {
  if (!isLanguage(next)) return;

  setLanguage(next);
  document.documentElement.lang = getLocale();
  localise(document);
  document.querySelectorAll('template').forEach((template) => localise(template.content));
};
