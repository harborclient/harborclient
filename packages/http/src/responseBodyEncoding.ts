/**
 * Bytes sampled when detecting binary content via null bytes.
 */
const BINARY_SAMPLE_BYTES = 8192;

/**
 * Content-types where a body heuristic may still indicate JSON or HTML.
 */
const GENERIC_CONTENT_TYPES = new Set(['', 'application/octet-stream']);

/**
 * Returns the MIME type portion of a Content-Type header (without parameters).
 *
 * @param contentType - Raw Content-Type header value, possibly with charset.
 * @returns Lowercased type/subtype, or empty string when missing.
 */
function normalizeContentType(contentType: string): string {
  return contentType.toLowerCase().split(';')[0]?.trim() ?? '';
}

/**
 * Returns true when the sampled bytes contain a null byte (binary signal).
 *
 * @param bytes - Raw response body bytes.
 */
function hasNullByte(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, BINARY_SAMPLE_BYTES));
  return sample.includes(0);
}

/**
 * Returns true when trimmed body content looks like an HTML document or fragment.
 *
 * @param body - UTF-8-decoded response body string.
 */
function looksLikeHtml(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed.startsWith('<')) {
    return false;
  }
  if (/^<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return true;
  }
  return /<\/(html|body|div|p|span|table|head|title|h[1-6])>/i.test(trimmed);
}

/**
 * Returns true when the body is valid JSON.
 *
 * @param body - UTF-8-decoded response body string.
 */
function isValidJson(body: string): boolean {
  if (!body.trim()) {
    return false;
  }
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns true when the Content-Type is explicitly textual (JSON, HTML, text, XML, JS, form).
 *
 * @param mime - Normalized MIME type (no parameters).
 */
function isExplicitlyTextualMime(mime: string): boolean {
  if (mime.startsWith('text/')) {
    return true;
  }
  if (
    mime.includes('json') ||
    mime.includes('html') ||
    mime.includes('xml') ||
    mime.includes('javascript') ||
    mime.includes('ecmascript')
  ) {
    return true;
  }
  return mime === 'application/x-www-form-urlencoded';
}

/**
 * Decides whether a response body should be stored as base64 for lossless access.
 *
 * Textual responses (JSON, text-ish, HTML-ish) omit base64. Images and other
 * non-textual bodies include it. For empty / `application/octet-stream`
 * Content-Types, JSON and HTML body heuristics keep the payload as text;
 * empty Content-Type with no null bytes is treated as text, while null bytes
 * force base64.
 *
 * @param contentType - Response Content-Type header value (may include charset).
 * @param bytes - Raw response body bytes.
 * @returns True when `bodyBase64` should be set on the read result.
 */
export function shouldEncodeResponseBodyBase64(contentType: string, bytes: Uint8Array): boolean {
  const mime = normalizeContentType(contentType);

  if (mime.startsWith('image/')) {
    return true;
  }

  if (isExplicitlyTextualMime(mime)) {
    return false;
  }

  if (GENERIC_CONTENT_TYPES.has(mime)) {
    const body = new TextDecoder().decode(bytes);
    if (isValidJson(body) || looksLikeHtml(body)) {
      return false;
    }
    if (mime === '' && !hasNullByte(bytes)) {
      return false;
    }
    return true;
  }

  return true;
}
