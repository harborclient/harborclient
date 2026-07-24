import { basename } from 'path';

/**
 * Normalizes a SQLite database filename so it stays within userData.
 * Trims input, strips directory components, and rejects traversal segments.
 *
 * @param value - Raw filename from storage or user input.
 * @param fallback - Default when value is blank or unsafe after normalization.
 * @returns A single-segment filename safe for `join(userData, filename)`.
 */
export function normalizeSqliteFilename(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const filename = basename(trimmed);
  if (
    !filename ||
    filename === '.' ||
    filename === '..' ||
    filename.includes('/') ||
    filename.includes('\\')
  ) {
    return fallback;
  }

  return filename;
}
