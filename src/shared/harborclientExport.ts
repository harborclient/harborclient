/**
 * Known HarborClient portable export discriminators used for File -> Import routing.
 */
export const HARBORCLIENT_EXPORT_KINDS = [
  'collection',
  'request',
  'environment',
  'snippet',
  'theme',
  'collection-run-results',
  'request-run-results'
] as const;

/**
 * Discriminator value on a HarborClient portable export JSON file.
 */
export type HarborclientExportKind = (typeof HARBORCLIENT_EXPORT_KINDS)[number];

/**
 * Returns whether a string is a known HarborClient export discriminator.
 *
 * @param value - Raw discriminator string from parsed JSON.
 * @returns True when the value matches a supported export kind.
 */
export function isHarborclientExportKind(value: string): value is HarborclientExportKind {
  return (HARBORCLIENT_EXPORT_KINDS as readonly string[]).includes(value);
}

/**
 * Reads the HarborClient export discriminator from parsed JSON.
 *
 * @param parsed - Parsed JSON payload from an import file.
 * @returns Export kind when recognized, or null when absent or unknown.
 */
export function readHarborclientExport(parsed: unknown): HarborclientExportKind | null {
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const value = (parsed as { harborclientExport?: unknown }).harborclientExport;
  if (typeof value !== 'string' || !isHarborclientExportKind(value)) {
    return null;
  }

  return value;
}
