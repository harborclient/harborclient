/**
 * Normalizes a comma-separated request tags string for storage and search indexing.
 *
 * @param raw - User-entered tags text from the Notes tab.
 * @returns Trimmed, non-empty tags joined with ", ".
 */
export function normalizeRequestTags(raw: string): string {
  return formatRequestTags(parseRequestTags(raw));
}

/**
 * Splits a comma-separated tags string into trimmed, non-empty tag segments.
 *
 * @param raw - Comma-separated tags text from the request draft or storage.
 * @returns Ordered tag labels with surrounding whitespace and empty segments removed.
 */
export function parseRequestTags(raw: string): string[] {
  return raw
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

/**
 * Formats committed tag labels into the normalized comma-separated storage string.
 *
 * @param tags - Ordered tag labels from the chip input UI.
 * @returns Trimmed tags joined with ", " for draft persistence and search indexing.
 */
export function formatRequestTags(tags: string[]): string {
  return tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .join(', ');
}
