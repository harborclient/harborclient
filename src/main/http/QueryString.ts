import type { KeyValue } from '#/shared/types';
import type { IQueryString } from '#/main/http/IQueryString';

/**
 * Builds and validates URLs and query strings for outbound requests.
 */
export class QueryString implements IQueryString {
  /**
   * HTTP schemes allowed for outbound requests.
   */
  private static readonly ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

  /**
   * Returns whether a URL string is a root-relative path (`/api`), not protocol-relative (`//cdn`).
   *
   * @param url - Trimmed URL string.
   */
  private isRootRelativePath(url: string): boolean {
    return url.startsWith('/') && !url.startsWith('//');
  }

  /**
   * Appends query parameters via string concatenation for root-relative paths.
   *
   * @param trimmed - Trimmed base URL that failed absolute URL parsing.
   * @param enabledParams - Enabled key-value pairs to append.
   */
  private appendQueryFallback(trimmed: string, enabledParams: KeyValue[]): string {
    const separator = trimmed.includes('?') ? '&' : '?';
    const query = enabledParams
      .map((p) => `${encodeURIComponent(p.key.trim())}=${encodeURIComponent(p.value)}`)
      .join('&');
    return `${trimmed}${separator}${query}`;
  }

  /**
   * Appends enabled query parameters to a base URL.
   *
   * @param baseUrl - Request URL before query string merging.
   * @param params - Key-value pairs to append as search params.
   * @returns URL with merged query parameters.
   */
  buildUrl(baseUrl: string, params: KeyValue[]): string {
    const trimmed = baseUrl.trim();
    if (!trimmed) return trimmed;

    const enabledParams = params.filter((p) => p.enabled && p.key.trim());
    if (enabledParams.length === 0) return trimmed;

    try {
      const url = new URL(trimmed);
      if (!QueryString.ALLOWED_PROTOCOLS.has(url.protocol)) {
        return trimmed;
      }
      for (const param of enabledParams) {
        url.searchParams.set(param.key.trim(), param.value);
      }
      return url.toString();
    } catch {
      if (!this.isRootRelativePath(trimmed)) {
        return trimmed;
      }
      return this.appendQueryFallback(trimmed, enabledParams);
    }
  }

  /**
   * Returns whether a URL is safe to send via fetch: absolute http(s) or root-relative path.
   *
   * @param url - Request URL before or after query string merging.
   * @returns True when the URL uses http/https or is a root-relative path.
   */
  isValidRequestUrl(url: string): boolean {
    const trimmed = url.trim();
    if (!trimmed) return false;

    try {
      return QueryString.ALLOWED_PROTOCOLS.has(new URL(trimmed).protocol);
    } catch {
      return this.isRootRelativePath(trimmed);
    }
  }
}
