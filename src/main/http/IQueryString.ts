import type { KeyValue } from '#/shared/types';

/**
 * URL query string building and validation for outbound HTTP requests.
 */
export interface IQueryString {
  /**
   * Appends enabled query parameters to a base URL.
   *
   * @param baseUrl - Request URL before query string merging.
   * @param params - Key-value pairs to append as search params.
   */
  buildUrl(baseUrl: string, params: KeyValue[]): string;

  /**
   * Returns whether a URL is safe to send via fetch: absolute http(s) or root-relative path.
   *
   * @param url - Request URL before or after query string merging.
   */
  isValidRequestUrl(url: string): boolean;
}
