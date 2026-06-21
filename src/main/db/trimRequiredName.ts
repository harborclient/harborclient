/**
 * Trims a display name and rejects empty results.
 *
 * Matches import validation in {@link collectionExportSchema} so runtime
 * create/update paths cannot persist blank names that Zod would reject on import.
 *
 * @param name - Raw name from IPC or internal callers.
 * @param label - Entity label for the error message (e.g. "Collection name").
 * @returns Trimmed non-empty name.
 * @throws When the trimmed name is empty.
 */
export function trimRequiredName(name: string, label: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}
