import { readFile } from 'fs/promises';
import { basename } from 'path';
import { parseFormParts } from './formData.js';
import { parseUrlEncodedParts } from './urlencoded.js';
import type { BuildMultipartResult, ExpandMultipartRawResult, IBody } from './IBody.js';

/**
 * Matches a path-embedded multipart file token anywhere in raw body text.
 */
const MULTIPART_FILE_TOKEN_RE = /<<file:([^\n>]+)>>/g;

/**
 * Encodes request bodies for multipart, urlencoded, and preview display.
 */
export class Body implements IBody {
  /**
   * Builds a human-readable summary of multipart form parts for request preview.
   *
   * @param body - Serialized multipart form parts JSON.
   * @returns Summary string for SentRequest.body.
   */
  summarizeFormParts(body: string): string {
    const parts = parseFormParts(body).filter((part) => part.enabled && part.key.trim());
    if (parts.length === 0) {
      return '';
    }

    return parts
      .map((part) => {
        const key = part.key.trim();
        if (part.type === 'file') {
          const names = part.files.map((filePath) => basename(filePath)).join(', ');
          return `${key}: [${names || 'no files'}]`;
        }
        return `${key}: ${part.value}`;
      })
      .join('\n');
  }

  /**
   * Builds a FormData body from serialized multipart form parts.
   *
   * @param body - Serialized multipart form parts JSON.
   * @returns FormData ready for fetch, or an error message when a file cannot be read.
   */
  async buildMultipart(body: string): Promise<BuildMultipartResult> {
    const parts = parseFormParts(body).filter((part) => part.enabled && part.key.trim());
    const formData = new FormData();

    for (const part of parts) {
      const key = part.key.trim();
      if (part.type === 'file') {
        for (const filePath of part.files) {
          try {
            const data = await readFile(filePath);
            formData.append(key, new Blob([Uint8Array.from(data)]), basename(filePath));
          } catch {
            return { error: `Failed to read file: ${filePath}` };
          }
        }
        continue;
      }

      formData.append(key, part.value);
    }

    return { formData };
  }

  /**
   * Expands a verbatim multipart raw body, replacing `<<file:/path>>` tokens with file bytes.
   *
   * Malformed multipart structure is preserved as typed so intentionally invalid bodies
   * can be sent for testing. Only unreadable files produce an error.
   *
   * @param raw - Verbatim multipart body text from the Raw editor.
   * @returns Wire bytes plus Content-Type, or an error when a file cannot be read.
   */
  async expandMultipartRaw(raw: string): Promise<ExpandMultipartRawResult> {
    const firstLine = raw.split(/\r?\n/, 1)[0] ?? '';
    let boundary = '';
    if (firstLine.startsWith('--')) {
      boundary = firstLine.slice(2);
      if (boundary.endsWith('--')) {
        boundary = boundary.slice(0, -2);
      }
    }
    const contentType = boundary
      ? `multipart/form-data; boundary=${boundary}`
      : 'multipart/form-data';

    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    let lastIndex = 0;
    MULTIPART_FILE_TOKEN_RE.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = MULTIPART_FILE_TOKEN_RE.exec(raw)) !== null) {
      chunks.push(encoder.encode(raw.slice(lastIndex, match.index)));
      const filePath = match[1] ?? '';
      try {
        const data = await readFile(filePath);
        chunks.push(Uint8Array.from(data));
      } catch {
        return { error: `Failed to read file: ${filePath}` };
      }
      lastIndex = match.index + match[0].length;
    }
    chunks.push(encoder.encode(raw.slice(lastIndex)));

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }

    return { body, contentType };
  }

  /**
   * Builds an application/x-www-form-urlencoded body from serialized key-value rows.
   *
   * @param body - JSON array stored in the request body field.
   * @returns URL-encoded query string for the request body.
   */
  buildUrlEncoded(body: string): string {
    const rows = parseUrlEncodedParts(body).filter((row) => row.enabled && row.key.trim());
    const params = new URLSearchParams();
    for (const row of rows) {
      params.append(row.key.trim(), row.value);
    }
    return params.toString();
  }
}
