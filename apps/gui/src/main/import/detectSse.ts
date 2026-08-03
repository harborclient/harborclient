import type { KeyValue } from '@harborclient/core/types';

/**
 * Media type substring that identifies Server-Sent Events streams.
 */
const EVENT_STREAM_MEDIA_TYPE = 'text/event-stream';

/**
 * Returns whether a Content-Type or Accept media-type value indicates SSE.
 *
 * Matching is case-insensitive and allows parameters or multi-value lists
 * (for example `text/event-stream; charset=utf-8` or
 * `text/event-stream, application/json`).
 *
 * @param value - Raw header or mime-type string from an import source.
 * @returns True when the value includes `text/event-stream`.
 */
export function isEventStreamMediaType(value: string): boolean {
  return value.trim().toLowerCase().includes(EVENT_STREAM_MEDIA_TYPE);
}

/**
 * Returns whether enabled request headers signal an SSE client request.
 *
 * Postman, Bruno, OpenCollection, and similar formats store SSE endpoints as
 * ordinary HTTP requests; an enabled `Accept: text/event-stream` header is the
 * portable signal HarborClient uses to set `protocol: 'sse'` on import.
 *
 * @param headers - Converted HarborClient header rows.
 * @returns True when an enabled Accept header includes `text/event-stream`.
 */
export function headersIndicateSse(headers: KeyValue[]): boolean {
  return headers.some(
    (header) =>
      header.enabled &&
      header.key.trim().toLowerCase() === 'accept' &&
      isEventStreamMediaType(header.value)
  );
}
