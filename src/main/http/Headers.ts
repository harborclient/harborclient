import type { BodyType, KeyValue } from '#/shared/types';
import type { ApplyCookieResult, BuildHeadersResult, IHeaders } from '#/main/http/IHeaders';
import { validateHeaderField } from '#/shared/httpHeaders';

/**
 * Builds request headers and merges cookie jar values for outbound requests.
 */
export class Headers implements IHeaders {
  /**
   * Builds request headers from enabled key-value pairs and body type defaults.
   *
   * Rejects hop-by-hop headers and fields containing control characters or CRLF.
   *
   * @param headers - User-defined headers.
   * @param bodyType - Body type used to infer Content-Type when absent.
   * @returns Header map ready for fetch, or an error when a field is invalid.
   */
  build(headers: KeyValue[], bodyType: BodyType): BuildHeadersResult {
    const result: Record<string, string> = {};

    for (const header of headers) {
      if (header.enabled && header.key.trim()) {
        const key = header.key.trim();
        if (bodyType === 'multipart' && key.toLowerCase() === 'content-type') {
          continue;
        }
        const validationError = validateHeaderField(key, header.value);
        if (validationError) {
          return { ok: false, error: validationError };
        }
        result[key] = header.value;
      }
    }

    const hasContentType = Object.keys(result).some((key) => key.toLowerCase() === 'content-type');

    if (!hasContentType) {
      if (bodyType === 'json') {
        result['Content-Type'] = 'application/json';
      } else if (bodyType === 'text') {
        result['Content-Type'] = 'text/plain';
      } else if (bodyType === 'urlencoded') {
        result['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }

    return { ok: true, headers: result };
  }

  /**
   * Validates and merges a cookie jar header when no Cookie header is already present.
   *
   * @param headers - Mutable header map to update on success.
   * @param cookieHeader - Optional Cookie header value from the cookie jar.
   */
  applyCookie(
    headers: Record<string, string>,
    cookieHeader: string | undefined
  ): ApplyCookieResult {
    const hasCookieHeader = Object.keys(headers).some((key) => key.toLowerCase() === 'cookie');
    if (!cookieHeader || hasCookieHeader) {
      return { ok: true };
    }

    const cookieError = validateHeaderField('Cookie', cookieHeader);
    if (cookieError) {
      return { ok: false, error: cookieError };
    }

    headers.Cookie = cookieHeader;
    return { ok: true };
  }
}
