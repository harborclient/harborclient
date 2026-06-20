import type { BodyType } from '#/shared/types';

/**
 * Pretty-prints JSON response bodies when valid; returns raw text otherwise.
 *
 * @param body - Raw response body string.
 * @returns Formatted body for display.
 */
export function formatBody(body: string): string {
  if (!body) return '';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

/**
 * Formats a sent request body for console display based on body type.
 *
 * @param body - Raw or summarized request body string.
 * @param bodyType - Request body type when known.
 * @returns Formatted body for display.
 */
export function formatSentRequestBody(body: string, bodyType?: BodyType): string {
  if (!body) return '';
  if (bodyType === 'multipart' || bodyType === 'urlencoded') {
    return body;
  }
  return formatBody(body);
}

/**
 * Returns true when the body is valid JSON.
 *
 * @param body - Raw body string.
 */
export function isValidJson(body: string): boolean {
  if (!body.trim()) return false;
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

/**
 * Chooses a syntax mode from content-type or JSON validity.
 *
 * @param body - Raw body string.
 * @param headers - Response headers map.
 */
export function bodyLanguage(body: string, headers?: Record<string, string>): 'json' | 'text' {
  const contentType = headers?.['content-type'] ?? headers?.['Content-Type'] ?? '';
  if (contentType.includes('json')) return 'json';
  return isValidJson(body) ? 'json' : 'text';
}

/**
 * Chooses a syntax mode for a sent request body based on body type and headers.
 *
 * @param body - Raw or summarized request body string.
 * @param bodyType - Request body type when known.
 * @param headers - Request headers map.
 */
export function sentRequestBodyLanguage(
  body: string,
  bodyType?: BodyType,
  headers?: Record<string, string>
): 'json' | 'text' {
  if (bodyType === 'multipart' || bodyType === 'urlencoded') {
    return 'text';
  }
  return bodyLanguage(body, headers);
}

/**
 * Section title for a sent request body in the console inspector.
 *
 * @param bodyType - Request body type when known.
 */
export function sentRequestBodySectionTitle(bodyType?: BodyType): string {
  return bodyType === 'multipart' ? 'Form Data' : 'Payload';
}

/**
 * Formats a byte count as B, KB, or MB.
 *
 * @param bytes - Response body size in bytes.
 * @returns Human-readable size string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
