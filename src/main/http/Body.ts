import { readFile } from 'fs/promises';
import { basename } from 'path';
import { parseFormParts } from '#/shared/formData';
import { parseUrlEncodedParts } from '#/shared/urlencoded';
import type { BuildMultipartResult, IBody } from '#/main/http/IBody';

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
