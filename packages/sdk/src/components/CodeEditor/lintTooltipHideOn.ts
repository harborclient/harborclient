import type { Transaction } from '@codemirror/state';

/**
 * Keeps lint hover tooltips open across diagnostic refreshes; only hides when
 * the document changes under the hovered diagnostic range.
 *
 * CodeMirror's default lint `hideOn` closes tooltips whenever
 * `setDiagnosticsEffect` fires — including deferred syntax-linter passes that
 * leave the hovered diagnostic unchanged. Returning a boolean (not `null`)
 * skips that default and keeps the tooltip readable while the pointer stays
 * over the squiggle.
 *
 * @param tr - Transaction that may hide an open lint tooltip.
 * @param from - Start of the hovered diagnostic range.
 * @param to - End of the hovered diagnostic range.
 * @returns `true` when the tooltip should hide because the range was edited.
 */
export function lintTooltipHideOn(tr: Transaction, from: number, to: number): boolean {
  return !!tr.changes.touchesRange(from, to);
}
