/**
 * Shared helpers for `hc` namespace docs generation and validation.
 */

/**
 * Returns the namespace segment for a manifest key (`ui.registerModal` → `ui`).
 *
 * @param {string} key Manifest key.
 * @returns {string}
 */
export const namespaceOfKey = (key) => {
  const dot = key.indexOf('.');

  return dot === -1 ? key : key.slice(0, dot);
};

/**
 * Truncates a manifest description to a single plain-text sentence for the index.
 *
 * @param {string} description Manifest description markdown.
 * @returns {string}
 */
export const oneSentence = (description) => {
  let text = description
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\*\*Manifest:\*\*[^\n]*\n+/gim, '')
    .replace(/^Manifest:[^\n]*\n+/gim, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const match = /^(.*?[.!?])(?:\s|$)/.exec(text);

  if (match) {
    return match[1].trim();
  }

  if (text.length > 160) {
    return `${text.slice(0, 157).trim()}…`;
  }

  return text;
};
