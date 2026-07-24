import type { BodyType, KeyValue, SendRequestInput } from '@harborclient/http';
import { multipartRawContentType } from '#/shared/multipartRaw';

/**
 * Applies a Raw body override to an outbound send payload.
 *
 * When `bodyRaw` is non-null, it becomes the authoritative body for sending (including
 * the empty string). For multipart/urlencoded, ensures a Content-Type header is present
 * so the Requester can preserve the boundary / urlencoded media type instead of
 * normalizing structured JSON.
 *
 * @param input - Send payload built from the structured draft / scripts.
 * @param bodyRaw - Verbatim override from the Raw editor, or null when inactive.
 * @param bodyType - Active body type (multipart or urlencoded when this applies).
 * @returns Input with `bodyRaw` set and Content-Type ensured when needed.
 */
export function applyBodyRawOverride(
  input: SendRequestInput,
  bodyRaw: string | null | undefined,
  bodyType: BodyType
): SendRequestInput {
  if (bodyRaw === null || bodyRaw === undefined) {
    return input;
  }

  const headers = ensureRawBodyContentType(input.headers, bodyRaw, bodyType);
  return {
    ...input,
    headers,
    bodyRaw
  };
}

/**
 * Ensures an explicit Content-Type header for raw multipart/urlencoded overrides.
 *
 * @param headers - Existing request headers.
 * @param bodyRaw - Verbatim raw body text.
 * @param bodyType - Active body type.
 * @returns Headers with Content-Type added when missing for multipart/urlencoded.
 */
export function ensureRawBodyContentType(
  headers: KeyValue[],
  bodyRaw: string,
  bodyType: BodyType
): KeyValue[] {
  const hasContentType = headers.some(
    (header) => header.enabled && header.key.trim().toLowerCase() === 'content-type'
  );
  if (hasContentType) {
    return headers;
  }

  if (bodyType === 'urlencoded') {
    return [
      ...headers,
      {
        key: 'Content-Type',
        value: 'application/x-www-form-urlencoded',
        enabled: true
      }
    ];
  }

  if (bodyType === 'multipart') {
    return [
      ...headers,
      {
        key: 'Content-Type',
        value: multipartRawContentType(bodyRaw),
        enabled: true
      }
    ];
  }

  return headers;
}
