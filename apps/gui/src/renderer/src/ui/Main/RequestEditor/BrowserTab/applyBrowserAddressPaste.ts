/**
 * Computes the address-bar value after a paste replaces the current selection.
 *
 * @param value - Current address-bar text.
 * @param selectionStart - Caret/selection start, or null when unknown.
 * @param selectionEnd - Selection end, or null when unknown.
 * @param pasted - Clipboard text being inserted.
 * @returns Value after the paste is applied.
 */
export function applyBrowserAddressPaste(
  value: string,
  selectionStart: number | null,
  selectionEnd: number | null,
  pasted: string
): string {
  const start = selectionStart ?? value.length;
  const end = selectionEnd ?? start;
  return value.slice(0, start) + pasted + value.slice(end);
}
