/**
 * Formats an unread notice count for rail badge display, capping at `99+`.
 *
 * @param count - Raw unread notice count.
 * @returns Badge label or null when the count is zero.
 */
export function formatNoticeBadgeCount(count: number): string | null {
  if (count <= 0) {
    return null;
  }
  if (count > 99) {
    return '99+';
  }
  return String(count);
}
