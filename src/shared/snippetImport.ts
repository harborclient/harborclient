/**
 * Filename pattern for snippet names that may be imported via relative ESM paths.
 *
 * Segments use letters, digits, dots, underscores, and hyphens; the name must
 * end with `.js` and must not start with `/`.
 */
export const SNIPPET_IMPORT_NAME_PATTERN = /^[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*\.js$/;

/**
 * Returns whether a snippet display name is a valid importable module filename.
 *
 * Names such as `pass-testing.js` or `utils/format-date.js` may be imported
 * with `import { x } from './pass-testing.js'`. Human-readable names without
 * a `.js` suffix (for example `Pass Testing`) are not importable.
 *
 * @param name - Snippet display name from the library.
 * @returns True when the name can be used as a relative import target.
 */
export function isImportableSnippetName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.startsWith('/')) {
    return false;
  }

  if (!SNIPPET_IMPORT_NAME_PATTERN.test(trimmed)) {
    return false;
  }

  const segments = trimmed.split('/');
  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      return false;
    }
  }

  return true;
}
