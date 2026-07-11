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
