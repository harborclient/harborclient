/**
 * Known HarborClient portable export discriminators used for File -> Import routing.
 */
export declare const HARBORCLIENT_EXPORT_KINDS: readonly ["collection", "request", "environment", "snippet", "theme", "collection-run-results", "request-run-results", "tab_group"];
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
export declare function isHarborclientExportKind(value: string): value is HarborclientExportKind;
/**
 * Reads the HarborClient export discriminator from parsed JSON.
 *
 * @param parsed - Parsed JSON payload from an import file.
 * @returns Export kind when recognized, or null when absent or unknown.
 */
export declare function readHarborclientExport(parsed: unknown): HarborclientExportKind | null;
//# sourceMappingURL=harborclientExport.d.ts.map