import { z } from 'zod';
import type { ICookieJar } from '../interfaces';
import { isPlainObject, parseJson } from '../parseJson';
import type { KeyValue } from '../types';

const STORE_KEY = 'cookieJar';

interface StoredCookie extends KeyValue {
  secure?: boolean;
}

/**
 * One persisted cookie row. Extra fields are ignored; invalid rows are dropped.
 */
const storedCookieSchema = z.object({
  key: z.string(),
  value: z.string(),
  enabled: z.boolean().optional(),
  secure: z.boolean().optional()
});

/**
 * Minimal persistence contract required by the portable cookie jar.
 *
 * GUI storage, CLI configuration, and test fakes can all provide this adapter
 * without coupling the HTTP engine to a database implementation.
 */
export interface CookieJarStorage {
  /**
   * Reads a persisted value by key.
   *
   * @param key - Storage key to read.
   * @returns Stored string, or undefined when no value has been written.
   */
  getSetting(key: string): string | undefined;

  /**
   * Persists a value by key.
   *
   * @param key - Storage key to write.
   * @param value - Serialized value to persist.
   */
  setSetting(key: string, value: string): void;
}

/**
 * Persists cookies by hostname in the local registry and builds Cookie headers
 * for outbound HTTP requests.
 */
export class CookieJar implements ICookieJar {
  private readonly storage: CookieJarStorage;

  /**
   * @param storage - Persistence adapter used to store the jar map.
   */
  constructor(storage: CookieJarStorage) {
    this.storage = storage;
  }

  /**
   * Extracts the hostname from a URL string.
   *
   * @param url - Absolute or relative URL.
   * @returns Hostname or null when parsing fails.
   */
  static hostFromUrl(url: string): string | null {
    const trimmed = url.trim();
    if (!trimmed) return null;

    try {
      return new URL(trimmed).hostname || null;
    } catch {
      try {
        return new URL(`https://${trimmed}`).hostname || null;
      } catch {
        return null;
      }
    }
  }

  /**
   * Returns cookies stored for a hostname.
   *
   * @param domain - Hostname to query.
   */
  getCookiesForDomain(domain: string): KeyValue[] {
    return this.getStoredCookiesForDomain(domain).map(({ key, value, enabled }) => ({
      key,
      value,
      enabled
    }));
  }

  /**
   * Returns persisted cookie domains in a stable order for management UIs.
   *
   * @returns Sorted hostnames with at least one stored cookie.
   */
  listDomains(): string[] {
    return Object.keys(this.getJarMap()).sort();
  }

  /**
   * Persists cookies for a hostname.
   *
   * @param domain - Hostname to update.
   * @param cookies - Cookie rows to store.
   */
  setCookiesForDomain(domain: string, cookies: KeyValue[]): void {
    const normalized = this.normalizeDomain(domain);
    if (!normalized) return;

    const existing = this.getStoredCookiesForDomain(normalized);
    const normalizedCookies = this.normalizeCookieRows(cookies, existing);
    this.setStoredCookiesForDomain(normalized, normalizedCookies);
  }

  /**
   * Builds a Cookie header value for enabled cookies on the request host.
   *
   * @param url - Request URL used to resolve the host.
   * @returns Semicolon-delimited cookie header value, or null when none apply.
   */
  buildCookieHeader(url: string): string | null {
    const host = CookieJar.hostFromUrl(url);
    if (!host) return null;

    const scheme = this.schemeFromUrl(url);
    const isSecureRequest = scheme === 'https:';

    const cookies = this.getStoredCookiesForDomain(host).filter((cookie) => {
      if (!cookie.enabled || !cookie.key.trim()) return false;
      if (cookie.secure && !isSecureRequest) return false;
      if (this.hasUnsafeCookieChars(cookie.key) || this.hasUnsafeCookieChars(cookie.value)) {
        return false;
      }
      return true;
    });

    if (cookies.length === 0) return null;

    return cookies.map((cookie) => `${cookie.key}=${cookie.value}`).join('; ');
  }

  /**
   * Upserts or removes cookies from the jar based on Set-Cookie response headers.
   *
   * @param url - Request URL used to resolve the host.
   * @param setCookieHeaders - Set-Cookie header values from the response.
   */
  captureSetCookies(url: string, setCookieHeaders: string[] | undefined): void {
    if (!setCookieHeaders?.length) return;

    const host = CookieJar.hostFromUrl(url);
    if (!host) return;

    const cookieMap = new Map(
      this.getStoredCookiesForDomain(host).map((cookie) => [cookie.key, cookie])
    );

    for (const header of setCookieHeaders) {
      const parsed = this.parseSetCookieNameValue(header);
      if (!parsed) continue;

      if (this.isSetCookieExpired(header)) {
        cookieMap.delete(parsed.name);
        continue;
      }

      if (this.hasUnsafeCookieChars(parsed.name) || this.hasUnsafeCookieChars(parsed.value)) {
        continue;
      }

      cookieMap.set(parsed.name, {
        key: parsed.name,
        value: parsed.value,
        enabled: true,
        secure: this.isSetCookieSecure(header)
      });
    }

    this.setStoredCookiesForDomain(host, Array.from(cookieMap.values()));
  }

  /**
   * Returns whether a cookie name or value contains characters unsafe for Cookie
   * header serialization, such as control characters or semicolons that could
   * inject attribute-like segments (e.g. `; Secure`).
   *
   * @param value - Cookie name or value to inspect.
   */
  private hasUnsafeCookieChars(value: string): boolean {
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code <= 0x1f || code === 0x7f || code === 0x3b) {
        return true;
      }
    }
    return false;
  }

  /**
   * Reads persisted cookies keyed by hostname.
   *
   * Corrupt JSON, non-object roots, invalid domain entries, and malformed cookie
   * rows are skipped so a damaged jar degrades to an empty or partial map.
   */
  private getJarMap(): Record<string, StoredCookie[]> {
    return this.normalizeJarMap(parseJson(this.storage.getSetting(STORE_KEY), {}));
  }

  /**
   * Coerces an unknown parsed value into a hostname → cookies map.
   *
   * @param value - Parsed cookie jar JSON (or fallback).
   * @returns Validated map; empty when the root value is unusable.
   */
  private normalizeJarMap(value: unknown): Record<string, StoredCookie[]> {
    if (!isPlainObject(value)) {
      return {};
    }

    const jar: Record<string, StoredCookie[]> = {};
    for (const [rawDomain, rawCookies] of Object.entries(value)) {
      const domain = typeof rawDomain === 'string' ? rawDomain.trim().toLowerCase() : '';
      if (!domain || !Array.isArray(rawCookies)) {
        continue;
      }

      const cookies: StoredCookie[] = [];
      for (const entry of rawCookies) {
        const parsed = storedCookieSchema.safeParse(entry);
        if (!parsed.success) {
          continue;
        }
        cookies.push({
          key: parsed.data.key,
          value: parsed.data.value,
          enabled: parsed.data.enabled !== false,
          secure: parsed.data.secure === true
        });
      }

      if (cookies.length > 0) {
        jar[domain] = cookies;
      }
    }

    return jar;
  }

  /**
   * Persists the cookie jar map to the local registry.
   *
   * @param jar - Domain to cookies map.
   */
  private persistJarMap(jar: Record<string, StoredCookie[]>): void {
    this.storage.setSetting(STORE_KEY, JSON.stringify(jar));
  }

  /**
   * Normalizes a hostname for cookie storage lookup.
   *
   * @param domain - Raw hostname or URL host.
   */
  private normalizeDomain(domain: string): string {
    return domain.trim().toLowerCase();
  }

  /**
   * Filters out rows with both key and value empty.
   *
   * @param cookies - Cookie rows to normalize.
   * @param existing - Previously stored cookies used to preserve the secure flag.
   */
  private normalizeCookieRows(cookies: KeyValue[], existing: StoredCookie[] = []): StoredCookie[] {
    const existingByKey = new Map(existing.map((cookie) => [cookie.key, cookie]));

    return cookies
      .filter((cookie) => cookie.key.trim() || cookie.value.trim())
      .map((cookie) => {
        const key = cookie.key.trim();
        return {
          key,
          value: cookie.value,
          enabled: cookie.enabled !== false,
          secure: existingByKey.get(key)?.secure ?? false
        };
      });
  }

  /**
   * Returns stored cookies for a hostname, including internal metadata.
   *
   * @param domain - Hostname to query.
   */
  private getStoredCookiesForDomain(domain: string): StoredCookie[] {
    const normalized = this.normalizeDomain(domain);
    if (!normalized) return [];

    const cookies = this.getJarMap()[normalized];
    if (!Array.isArray(cookies)) return [];

    return cookies.map((cookie) => ({ ...cookie }));
  }

  /**
   * Persists stored cookies for a hostname.
   *
   * @param domain - Hostname to update.
   * @param cookies - Cookie rows to store.
   */
  private setStoredCookiesForDomain(domain: string, cookies: StoredCookie[]): void {
    const normalized = this.normalizeDomain(domain);
    if (!normalized) return;

    const jar = this.getJarMap();

    if (cookies.length === 0) {
      if (normalized in jar) {
        delete jar[normalized];
        this.persistJarMap(jar);
      }
      return;
    }

    jar[normalized] = cookies;
    this.persistJarMap(jar);
  }

  /**
   * Extracts the URL scheme from a URL string.
   *
   * @param url - Absolute or relative URL.
   * @returns Scheme including trailing colon, or null when parsing fails.
   */
  private schemeFromUrl(url: string): string | null {
    const trimmed = url.trim();
    if (!trimmed) return null;

    try {
      return new URL(trimmed).protocol || null;
    } catch {
      try {
        return new URL(`https://${trimmed}`).protocol || null;
      } catch {
        return null;
      }
    }
  }

  /**
   * Parses the name and value from a Set-Cookie header value.
   *
   * @param header - Raw Set-Cookie header string.
   */
  private parseSetCookieNameValue(header: string): { name: string; value: string } | null {
    const firstSegment = header.split(';')[0]?.trim();
    if (!firstSegment) return null;

    const separatorIndex = firstSegment.indexOf('=');
    if (separatorIndex <= 0) return null;

    const name = firstSegment.slice(0, separatorIndex).trim();
    if (!name) return null;

    return {
      name,
      value: firstSegment.slice(separatorIndex + 1)
    };
  }

  /**
   * Parses Set-Cookie attributes from a header value.
   *
   * @param header - Raw Set-Cookie header string.
   */
  private parseSetCookieAttributes(header: string): { name: string; value: string }[] {
    return header
      .split(';')
      .slice(1)
      .map((part) => part.trim())
      .map((attribute) => {
        const [rawName, ...rawValueParts] = attribute.split('=');
        return {
          name: rawName.trim().toLowerCase(),
          value: rawValueParts.join('=').trim()
        };
      });
  }

  /**
   * Returns whether a Set-Cookie header indicates the cookie should be deleted.
   *
   * @param header - Raw Set-Cookie header string.
   */
  private isSetCookieExpired(header: string): boolean {
    for (const attribute of this.parseSetCookieAttributes(header)) {
      if (attribute.name === 'max-age') {
        const maxAge = Number(attribute.value);
        if (Number.isFinite(maxAge) && maxAge <= 0) {
          return true;
        }
      }

      if (attribute.name === 'expires') {
        const expiresAt = Date.parse(attribute.value);
        if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Returns whether a Set-Cookie header marks the cookie as Secure.
   *
   * @param header - Raw Set-Cookie header string.
   */
  private isSetCookieSecure(header: string): boolean {
    return this.parseSetCookieAttributes(header).some((attribute) => attribute.name === 'secure');
  }
}
