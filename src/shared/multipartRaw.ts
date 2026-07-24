import type { FormDataPart } from '#/shared/types/common';

/**
 * Regex matching a path-embedded multipart file token on its own line.
 */
export const MULTIPART_FILE_TOKEN_RE = /^<<file:(.+)>>$/;

/**
 * Returns the final path segment of an absolute or relative file path.
 *
 * Avoids Node `path` so this module stays safe for the renderer bundle.
 *
 * @param filePath - Absolute or relative file path.
 * @returns Filename portion after the last `/` or `\`.
 */
function fileBasename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  return slash === -1 ? normalized : normalized.slice(slash + 1);
}

/**
 * Prefix used when generating multipart boundaries for the Raw body drawer.
 */
const BOUNDARY_PREFIX = '----HarborFormBoundary';

/**
 * Result of tolerantly parsing a raw multipart body into structured parts.
 */
export interface ParseMultipartRawResult {
  /**
   * Best-effort form parts derived from the raw text.
   */
  parts: FormDataPart[];

  /**
   * False when the raw text cannot cleanly map to structured rows (still sendable).
   */
  representable: boolean;

  /**
   * Boundary string detected in the raw text, when present.
   */
  boundary?: string;
}

/**
 * Generates a unique multipart boundary for rendering the Raw body drawer.
 *
 * @returns Boundary string suitable for `multipart/form-data; boundary=…`.
 */
export function generateMultipartBoundary(): string {
  const random = Math.random().toString(36).slice(2, 12);
  const time = Date.now().toString(36);
  return `${BOUNDARY_PREFIX}${time}${random}`;
}

/**
 * Builds a path-embedded file token for a multipart raw body line.
 *
 * @param filePath - Absolute file path to embed.
 * @returns Token line content such as `<<file:/abs/path>>`.
 */
export function multipartFileToken(filePath: string): string {
  return `<<file:${filePath}>>`;
}

/**
 * Returns whether raw multipart text contains at least one file token.
 *
 * Used at send time to choose between the verbatim text path and the
 * token-expanding encoder that reads file bytes from disk.
 *
 * @param text - Verbatim multipart body from the Raw editor.
 * @returns True when a `<<file:…>>` token is present.
 */
export function multipartRawHasFileTokens(text: string): boolean {
  return /<<file:[^\n>]+>>/.test(text);
}

/**
 * Escapes a Content-Disposition parameter value for double-quoted form fields.
 *
 * @param value - Name or filename to escape.
 * @returns Value safe to place inside double quotes.
 */
function escapeDispositionValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Renders structured multipart form parts as editable raw wire-like text.
 *
 * File payloads are replaced with `<<file:/abs/path>>` tokens so binary bytes
 * never enter the text editor. The boundary is caller-supplied so Content-Type
 * and body stay in sync when no raw override is active.
 *
 * @param parts - Multipart form parts from the structured editor.
 * @param boundary - Boundary string without leading dashes.
 * @returns Multipart body text with CRLF line endings.
 */
export function renderMultipartRaw(parts: FormDataPart[], boundary: string): string {
  const enabled = parts.filter((part) => part.enabled && part.key.trim());
  if (enabled.length === 0) {
    return '';
  }

  const chunks: string[] = [];
  for (const part of enabled) {
    const key = part.key.trim();
    chunks.push(`--${boundary}`);

    if (part.type === 'file') {
      if (part.files.length === 0) {
        chunks.push(
          `Content-Disposition: form-data; name="${escapeDispositionValue(key)}"; filename=""`
        );
        chunks.push('');
        chunks.push('');
        continue;
      }

      part.files.forEach((filePath, index) => {
        if (index > 0) {
          chunks.push(`--${boundary}`);
        }
        const filename = fileBasename(filePath) || 'file';
        chunks.push(
          `Content-Disposition: form-data; name="${escapeDispositionValue(key)}"; filename="${escapeDispositionValue(filename)}"`
        );
        chunks.push('');
        chunks.push(multipartFileToken(filePath));
      });
      continue;
    }

    chunks.push(`Content-Disposition: form-data; name="${escapeDispositionValue(key)}"`);
    chunks.push('');
    chunks.push(part.value);
  }

  chunks.push(`--${boundary}--`);
  return chunks.join('\r\n');
}

/**
 * Extracts a quoted or token parameter value from a Content-Disposition header.
 *
 * @param header - Full Content-Disposition header line value.
 * @param name - Parameter name such as `name` or `filename`.
 * @returns Parameter value, or undefined when absent.
 */
function dispositionParam(header: string, name: string): string | undefined {
  const re = new RegExp(`${name}\\s*=\\s*(?:"((?:\\\\.|[^"\\\\])*)"|([^;\\s]+))`, 'i');
  const match = header.match(re);
  if (!match) {
    return undefined;
  }
  if (match[1] !== undefined) {
    return match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return match[2];
}

/**
 * Detects the multipart boundary from the first `--…` line in raw text.
 *
 * @param text - Verbatim multipart body.
 * @returns Boundary without leading dashes, or undefined when not found.
 */
export function detectMultipartBoundary(text: string): string | undefined {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  if (!firstLine.startsWith('--')) {
    return undefined;
  }
  let boundary = firstLine.slice(2);
  if (boundary.endsWith('--')) {
    boundary = boundary.slice(0, -2);
  }
  return boundary || undefined;
}

/**
 * Builds a Content-Type header value for a raw multipart body.
 *
 * @param text - Verbatim multipart body (used to detect the boundary).
 * @returns `multipart/form-data; boundary=…`, or without boundary when undetectable.
 */
export function multipartRawContentType(text: string): string {
  const boundary = detectMultipartBoundary(text);
  if (!boundary) {
    return 'multipart/form-data';
  }
  return `multipart/form-data; boundary=${boundary}`;
}

/**
 * Tolerantly parses a raw multipart body into structured form parts.
 *
 * Never throws and never blocks sending. Returns `representable: false` when the
 * text cannot cleanly map to rows (missing boundary, broken part headers, etc.)
 * so the UI can detach the table while still sending the verbatim raw override.
 *
 * File tokens (`<<file:/abs/path>>`) resolve to file parts with that path.
 *
 * @param text - Verbatim multipart body from the Raw editor.
 * @returns Best-effort parts plus whether they cleanly represent the raw text.
 */
export function parseMultipartRaw(text: string): ParseMultipartRawResult {
  if (!text.trim()) {
    return { parts: [], representable: true };
  }

  const boundary = detectMultipartBoundary(text);
  if (!boundary) {
    return { parts: [], representable: false };
  }

  const delimiter = `--${boundary}`;
  const normalized = text.replace(/\r\n/g, '\n');
  const sections = normalized.split(delimiter);
  const parts: FormDataPart[] = [];
  let representable = true;

  for (const section of sections) {
    const trimmedStart = section.replace(/^\n/, '');
    if (!trimmedStart || trimmedStart === '--' || trimmedStart.startsWith('--')) {
      continue;
    }

    const bodySeparator = trimmedStart.indexOf('\n\n');
    if (bodySeparator === -1) {
      representable = false;
      continue;
    }

    const headerBlock = trimmedStart.slice(0, bodySeparator);
    let body = trimmedStart.slice(bodySeparator + 2);
    // Trailing newline before the next boundary is part of the wire format.
    if (body.endsWith('\n')) {
      body = body.slice(0, -1);
    }

    const headers = headerBlock.split('\n');
    let disposition = '';
    for (const line of headers) {
      const colon = line.indexOf(':');
      if (colon === -1) {
        continue;
      }
      const name = line.slice(0, colon).trim().toLowerCase();
      const value = line.slice(colon + 1).trim();
      if (name === 'content-disposition') {
        disposition = value;
      }
    }

    if (!disposition) {
      representable = false;
      continue;
    }

    const fieldName = dispositionParam(disposition, 'name');
    if (fieldName === undefined) {
      representable = false;
      continue;
    }

    const filename = dispositionParam(disposition, 'filename');
    const tokenMatch = body.match(MULTIPART_FILE_TOKEN_RE);

    if (filename !== undefined || tokenMatch) {
      const filePath = tokenMatch?.[1] ?? '';
      parts.push({
        key: fieldName,
        value: '',
        enabled: true,
        type: 'file',
        files: filePath ? [filePath] : []
      });
      continue;
    }

    parts.push({
      key: fieldName,
      value: body,
      enabled: true,
      type: 'text',
      files: []
    });
  }

  if (parts.length === 0 && text.trim()) {
    representable = false;
  }

  return { parts, representable, boundary };
}
