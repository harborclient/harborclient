import type { FormDataPart } from '../../types.js';

/**
 * Returns a blank multipart form part with enabled set to true.
 */
export function emptyFormPart(): FormDataPart {
  return { key: '', value: '', enabled: true, type: 'text', files: [] };
}

/**
 * Returns the file name portion of an absolute path.
 *
 * @param filePath - Absolute file path.
 */
export function fileBasename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
}

/**
 * Ensures at least one row exists and appends a trailing blank row when needed.
 *
 * @param parts - Current form parts.
 * @returns Rows safe to render in the editor.
 */
export function withTrailingRow(parts: FormDataPart[]): FormDataPart[] {
  if (parts.length === 0) {
    return [emptyFormPart()];
  }
  return parts;
}
