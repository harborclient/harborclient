/**
 * Builds a safe default filename for a single-runtime JSON export.
 *
 * @param name - Runtime display name.
 * @returns Filename ending in `.json`.
 */
export function runtimeExportFileName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '') {
    return 'runtime.json';
  }
  const safe = trimmed
    .replace(/[^\w\s.-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (safe === '') {
    return 'runtime.json';
  }
  return `${safe}.json`;
}
