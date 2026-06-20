import { getLocalRegistry } from '#/main/db/localRegistryInstance';
import { parseJson } from '#/shared/parseJson';
import type { KeyValue } from '#/shared/types';

const STORE_KEY = 'cookieJar';

interface StoredCookie extends KeyValue {
  secure?: boolean;
}

/**
 * Returns whether a cookie name or value contains control characters.
 *
 * @param value - Cookie name or value to inspect.
 */
function hasUnsafeCookieChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Reads persisted cookies keyed by hostname.
 */
function getJarMap(): Record<string, StoredCookie[]> {
  const stored = parseJson<Record<string, StoredCookie[]>>(
    getLocalRegistry().getSetting(STORE_KEY),
    {}
  );
  if (!stored || typeof stored !== 'object') {
    return {};
  }
  return stored;
}

/**
 * Persists the cookie jar map to the local registry.
 *
 * @param jar - Domain to cookies map.
 */
function persistJarMap(jar: Record<string, StoredCookie[]>): void {
  getLocalRegistry().setSetting(STORE_KEY, JSON.stringify(jar));
}

/**
 * Normalizes a hostname for cookie storage lookup.
 *
 * @param domain - Raw hostname or URL host.
 */
function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase();
}

/**
 * Filters out rows with both key and value empty.
 *
 * @param cookies - Cookie rows to normalize.
 * @param existing - Previously stored cookies used to preserve the secure flag.
 */
function normalizeCookieRows(cookies: KeyValue[], existing: StoredCookie[] = []): StoredCookie[] {
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
function getStoredCookiesForDomain(domain: string): StoredCookie[] {
  const normalized = normalizeDomain(domain);
  if (!normalized) return [];

  const cookies = getJarMap()[normalized];
  if (!Array.isArray(cookies)) return [];

  return cookies.map((cookie) => ({ ...cookie }));
}

/**
 * Persists stored cookies for a hostname.
 *
 * @param domain - Hostname to update.
 * @param cookies - Cookie rows to store.
 */
function setStoredCookiesForDomain(domain: string, cookies: StoredCookie[]): void {
  const normalized = normalizeDomain(domain);
  if (!normalized) return;

  const jar = getJarMap();

  if (cookies.length === 0) {
    if (normalized in jar) {
      delete jar[normalized];
      persistJarMap(jar);
    }
    return;
  }

  jar[normalized] = cookies;
  persistJarMap(jar);
}

/**
 * Extracts the hostname from a URL string.
 *
 * @param url - Absolute or relative URL.
 * @returns Hostname or null when parsing fails.
 */
export function hostFromUrl(url: string): string | null {
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
 * Extracts the URL scheme from a URL string.
 *
 * @param url - Absolute or relative URL.
 * @returns Scheme including trailing colon, or null when parsing fails.
 */
function schemeFromUrl(url: string): string | null {
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
 * Returns cookies stored for a hostname.
 *
 * @param domain - Hostname to query.
 */
export function getCookiesForDomain(domain: string): KeyValue[] {
  return getStoredCookiesForDomain(domain).map(({ key, value, enabled }) => ({
    key,
    value,
    enabled
  }));
}

/**
 * Persists cookies for a hostname.
 *
 * @param domain - Hostname to update.
 * @param cookies - Cookie rows to store.
 */
export function setCookiesForDomain(domain: string, cookies: KeyValue[]): void {
  const normalized = normalizeDomain(domain);
  if (!normalized) return;

  const existing = getStoredCookiesForDomain(normalized);
  const normalizedCookies = normalizeCookieRows(cookies, existing);
  setStoredCookiesForDomain(normalized, normalizedCookies);
}

/**
 * Builds a Cookie header value for enabled cookies on the request host.
 *
 * @param url - Request URL used to resolve the host.
 * @returns Semicolon-delimited cookie header value, or null when none apply.
 */
export function buildCookieHeader(url: string): string | null {
  const host = hostFromUrl(url);
  if (!host) return null;

  const scheme = schemeFromUrl(url);
  const isSecureRequest = scheme === 'https:';

  const cookies = getStoredCookiesForDomain(host).filter((cookie) => {
    if (!cookie.enabled || !cookie.key.trim()) return false;
    if (cookie.secure && !isSecureRequest) return false;
    if (hasUnsafeCookieChars(cookie.key) || hasUnsafeCookieChars(cookie.value)) return false;
    return true;
  });

  if (cookies.length === 0) return null;

  return cookies.map((cookie) => `${cookie.key}=${cookie.value}`).join('; ');
}

/**
 * Parses the name and value from a Set-Cookie header value.
 *
 * @param header - Raw Set-Cookie header string.
 */
function parseSetCookieNameValue(header: string): { name: string; value: string } | null {
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
function parseSetCookieAttributes(header: string): { name: string; value: string }[] {
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
function isSetCookieExpired(header: string): boolean {
  for (const attribute of parseSetCookieAttributes(header)) {
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
function isSetCookieSecure(header: string): boolean {
  return parseSetCookieAttributes(header).some((attribute) => attribute.name === 'secure');
}

/**
 * Upserts or removes cookies from the jar based on Set-Cookie response headers.
 *
 * @param url - Request URL used to resolve the host.
 * @param setCookieHeaders - Set-Cookie header values from the response.
 */
export function captureSetCookies(url: string, setCookieHeaders: string[] | undefined): void {
  if (!setCookieHeaders?.length) return;

  const host = hostFromUrl(url);
  if (!host) return;

  const cookieMap = new Map(getStoredCookiesForDomain(host).map((cookie) => [cookie.key, cookie]));

  for (const header of setCookieHeaders) {
    const parsed = parseSetCookieNameValue(header);
    if (!parsed) continue;

    if (isSetCookieExpired(header)) {
      cookieMap.delete(parsed.name);
      continue;
    }

    if (hasUnsafeCookieChars(parsed.name) || hasUnsafeCookieChars(parsed.value)) {
      continue;
    }

    cookieMap.set(parsed.name, {
      key: parsed.name,
      value: parsed.value,
      enabled: true,
      secure: isSetCookieSecure(header)
    });
  }

  setStoredCookiesForDomain(host, Array.from(cookieMap.values()));
}
