import type { KeyValue } from '@harborclient/core/types';
import type { CookieJarStorage } from '@harborclient/core/cookies/CookieJar';

/**
 * In-memory CookieJarStorage for ad-hoc CLI sessions that do not open the GUI database.
 */
export class MemoryCookieJarStorage implements CookieJarStorage {
  private readonly values = new Map<string, string>();

  /**
   * Reads a persisted value by key.
   *
   * @param key - Storage key.
   * @returns Stored string, or undefined when missing.
   */
  getSetting(key: string): string | undefined {
    return this.values.get(key);
  }

  /**
   * Persists a value by key.
   *
   * @param key - Storage key.
   * @param value - Serialized value.
   */
  setSetting(key: string, value: string): void {
    this.values.set(key, value);
  }
}

/**
 * Builds a KeyValue header row list from CLI `-H` / `--header` arguments.
 *
 * @param headers - Raw `Name: value` strings.
 * @returns Enabled header rows.
 */
export function parseHeaderArgs(headers: string[]): KeyValue[] {
  return headers.map((raw) => {
    const idx = raw.indexOf(':');
    if (idx < 0) {
      return { key: raw.trim(), value: '', enabled: true };
    }
    return {
      key: raw.slice(0, idx).trim(),
      value: raw.slice(idx + 1).trim(),
      enabled: true
    };
  });
}
