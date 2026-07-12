/**
 * Formats a timestamp as an absolute UTC date/time for tooltips and accessible labels.
 *
 * @param ts - Unix epoch milliseconds.
 * @returns Date/time string such as `2026-07-11 10:23:03`.
 */
export function formatSidebarAbsoluteDate(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Formats a timestamp as a short relative time string.
 *
 * @param ts - Unix epoch milliseconds.
 * @param now - Reference time for relative formatting.
 * @returns Human-readable relative time such as `5m ago`.
 */
export function formatRelativeTime(ts: number, now: number = Date.now()): string {
  const seconds = Math.floor((now - ts) / 1000);
  if (seconds < 5) {
    return 'just now';
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
