import type { Text } from '@codemirror/state';

/**
 * Document span to delete when removing a script reference badge, optionally including one
 * trailing whitespace separator auto-inserted after the `@` token.
 */
export interface ScriptReferenceRemovalRange {
  /**
   * Start offset of the deletion (inclusive).
   */
  from: number;

  /**
   * End offset of the deletion (exclusive).
   */
  to: number;
}

/**
 * Returns the document range to delete when the user dismisses a script reference badge.
 *
 * Extends the reference token by one character when a single whitespace separator immediately
 * follows, so auto-inserted trailing spaces or newlines are cleaned up with the badge.
 *
 * @param doc - Current CodeMirror document.
 * @param from - Start offset of the `@` reference token.
 * @param to - End offset (exclusive) of the `@` reference token.
 */
export function getScriptReferenceRemovalRange(
  doc: Text,
  from: number,
  to: number
): ScriptReferenceRemovalRange {
  if (to < doc.length && /\s/.test(doc.sliceString(to, to + 1))) {
    return { from, to: to + 1 };
  }

  return { from, to };
}
