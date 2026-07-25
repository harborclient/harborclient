import { byteLength, truncateToBytes as truncateUtf8 } from '../runtime-utils.js';

/**
 * Formats a timestamp as a short relative time string.
 *
 * @param ts - Unix epoch milliseconds.
 * @param now - Reference time for relative formatting.
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

/**
 * Formats a header map as plain text lines.
 *
 * @param headers - Flat header key/value map.
 */
export function formatHeaders(headers: Record<string, string>): string {
  const lines = Object.entries(headers).map(([key, value]) => `${key}: ${value}`);
  return lines.length > 0 ? lines.join('\n') : '(none)';
}

/**
 * Truncates a string to a maximum UTF-8 byte length without relying on TextEncoder.
 *
 * @param text - String to truncate.
 * @param maxBytes - Maximum UTF-8 bytes to retain.
 */
export function truncateToBytes(text: string, maxBytes: number): string {
  return truncateUtf8(text, maxBytes);
}

export { byteLength };
