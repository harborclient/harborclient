import type { FormDataPart, FormDataPartType } from './types.js';

/**
 * Returns a blank multipart form part with enabled set to true.
 */
export function emptyFormPart(): FormDataPart {
  return { key: '', value: '', enabled: true, type: 'text', files: [] };
}

/**
 * Coerces a partial or legacy form part record to the full FormDataPart shape.
 *
 * @param part - Raw part fields from storage or import.
 * @returns Normalized form part with defaults for missing fields.
 */
export function normalizeFormPart(part: Partial<FormDataPart>): FormDataPart {
  const type: FormDataPartType = part.type === 'file' ? 'file' : 'text';
  return {
    key: typeof part.key === 'string' ? part.key : '',
    value: typeof part.value === 'string' ? part.value : '',
    enabled: part.enabled !== false,
    type,
    files: Array.isArray(part.files)
      ? part.files.filter((file): file is string => typeof file === 'string')
      : []
  };
}

/**
 * Parses a serialized multipart body string into form parts.
 *
 * @param body - JSON array stored in the request body field.
 * @returns Parsed form parts, or an empty array when body is empty or invalid.
 */
export function parseFormParts(body: string): FormDataPart[] {
  const trimmed = body.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((part) => normalizeFormPart(part as Partial<FormDataPart>));
  } catch {
    return [];
  }
}

/**
 * Serializes form parts for storage in the request body field.
 *
 * @param parts - Multipart form parts to serialize.
 * @returns JSON string, or an empty string when there are no parts.
 */
export function serializeFormParts(parts: FormDataPart[]): string {
  if (parts.length === 0) {
    return '';
  }
  return JSON.stringify(parts.map((part) => normalizeFormPart(part)));
}
