import type { KeyValue } from '#/shared/types';

/**
 * Contract for persisting and applying cookies by hostname.
 */
export interface ICookieJar {
  /**
   * Returns cookies stored for a hostname.
   *
   * @param domain - Hostname to query.
   * @returns Cookie rows without internal metadata.
   */
  getCookiesForDomain(domain: string): KeyValue[];

  /**
   * Returns all hostnames with persisted cookies.
   *
   * @returns Sorted cookie domains.
   */
  listDomains(): string[];

  /**
   * Persists cookies for a hostname.
   *
   * @param domain - Hostname to update.
   * @param cookies - Cookie rows to store.
   */
  setCookiesForDomain(domain: string, cookies: KeyValue[]): void;

  /**
   * Builds a Cookie header value for enabled cookies on the request host.
   *
   * @param url - Request URL used to resolve the host.
   * @returns Semicolon-delimited cookie header value, or null when none apply.
   */
  buildCookieHeader(url: string): string | null;

  /**
   * Upserts or removes cookies from the jar based on Set-Cookie response headers.
   *
   * @param url - Request URL used to resolve the host.
   * @param setCookieHeaders - Set-Cookie header values from the response.
   */
  captureSetCookies(url: string, setCookieHeaders: string[] | undefined): void;
}
