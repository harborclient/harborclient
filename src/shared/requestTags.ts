/**
 * Normalizes a comma-separated request tags string for storage and search indexing.
 *
 * @param raw - User-entered tags text from the Notes tab.
 * @returns Trimmed, non-empty tags joined with ", ".
 */
export function normalizeRequestTags(raw: string): string {
  return raw
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join(', ');
}
