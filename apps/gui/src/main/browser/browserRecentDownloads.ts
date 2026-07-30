import type { BrowserDownloadEntry } from '@harborclient/core/types/api/browser';

/**
 * Maximum number of browser downloads kept in the session ring buffer.
 */
export const BROWSER_RECENT_DOWNLOADS_MAX = 5;

/**
 * Prepends a download and trims the list to the newest
 * {@link BROWSER_RECENT_DOWNLOADS_MAX} entries.
 *
 * @param current - Existing downloads, newest first.
 * @param entry - Download to insert at the front.
 * @returns Updated list, newest first, capped at the max length.
 */
export function prependRecentDownload(
  current: BrowserDownloadEntry[],
  entry: BrowserDownloadEntry
): BrowserDownloadEntry[] {
  return [entry, ...current].slice(0, BROWSER_RECENT_DOWNLOADS_MAX);
}

/**
 * Replaces an existing download by id, leaving order unchanged.
 * When the id is missing (for example it was trimmed from the ring buffer),
 * prepends the entry instead.
 *
 * @param current - Existing downloads, newest first.
 * @param entry - Updated entry to merge into the list.
 * @returns Updated list.
 */
export function updateRecentDownload(
  current: BrowserDownloadEntry[],
  entry: BrowserDownloadEntry
): BrowserDownloadEntry[] {
  const index = current.findIndex((item) => item.id === entry.id);
  if (index < 0) {
    return prependRecentDownload(current, entry);
  }
  const next = [...current];
  next[index] = entry;
  return next;
}

/**
 * Removes a download by id.
 *
 * @param current - Existing downloads, newest first.
 * @param id - Entry id to remove.
 * @returns Updated list without the matching entry.
 */
export function removeRecentDownload(
  current: BrowserDownloadEntry[],
  id: string
): BrowserDownloadEntry[] {
  return current.filter((item) => item.id !== id);
}
