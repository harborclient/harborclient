/**
 * Helpers for `@console.<section>.<row>#start.end` chat pointers.
 */

/**
 * Pattern for a console pointer section or row segment after slugification.
 */
export const CONSOLE_POINTER_SEGMENT_PATTERN = '[a-z][a-z0-9-]*';

/**
 * Slugifies a console row label or header name into a pointer segment.
 *
 * @param label - Human-readable label (for example `Request sent` or `report-to`).
 * @returns Kebab-case segment matching {@link CONSOLE_POINTER_SEGMENT_PATTERN}, or empty when unusable.
 */
export function slugifyConsolePointerSegment(label: string): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  if (normalized.length === 0) {
    return '';
  }

  if (/^[a-z][a-z0-9-]*$/.test(normalized)) {
    return normalized;
  }

  const withoutLeadingNonLetters = normalized.replace(/^[^a-z]+/, '');
  if (withoutLeadingNonLetters.length > 0 && /^[a-z][a-z0-9-]*$/.test(withoutLeadingNonLetters)) {
    return withoutLeadingNonLetters;
  }

  return `r-${normalized}`.replace(/-{2,}/g, '-');
}

/**
 * Builds an `@console` reference token for a selected console/header/timing cell.
 *
 * @param section - Section id (for example `general`, `headers`, `timing`).
 * @param row - Slugified row id.
 * @param startOffset - Inclusive character offset into the cell text.
 * @param endOffset - Exclusive character offset into the cell text.
 * @returns Compact `@console` token for the chat composer.
 */
export function buildConsoleReferenceToken(
  section: string,
  row: string,
  startOffset: number,
  endOffset: number
): string {
  return `@console.${section}.${row}#${startOffset}.${endOffset}`;
}
