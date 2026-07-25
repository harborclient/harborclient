import type { BodyType, KeyValue } from './types.js';

/**
 * Result of building request headers from user input.
 */
export type BuildHeadersResult =
  | { ok: true; headers: Record<string, string> }
  | { ok: false; error: string };

/**
 * Result of merging a cookie jar header into a request header map.
 */
export type ApplyCookieResult = { ok: true } | { ok: false; error: string };

/**
 * Request header construction and cookie header merging.
 */
export interface IHeaders {
  /**
   * Builds request headers from enabled key-value pairs and body type defaults.
   *
   * @param headers - User-defined headers.
   * @param bodyType - Body type used to infer Content-Type when absent.
   * @param options - When `preserveMultipartContentType` is true, keep a user Content-Type
   *   for multipart (used with raw body overrides that own the boundary).
   */
  build(
    headers: KeyValue[],
    bodyType: BodyType,
    options?: { preserveMultipartContentType?: boolean }
  ): BuildHeadersResult;

  /**
   * Validates and merges a cookie jar header when no Cookie header is already present.
   *
   * @param headers - Mutable header map to update on success.
   * @param cookieHeader - Optional Cookie header value from the cookie jar.
   */
  applyCookie(headers: Record<string, string>, cookieHeader: string | undefined): ApplyCookieResult;
}
