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
    'request-run-results',
    'tab_group'
];
/**
 * Returns whether a string is a known HarborClient export discriminator.
 *
 * @param value - Raw discriminator string from parsed JSON.
 * @returns True when the value matches a supported export kind.
 */
export function isHarborclientExportKind(value) {
    return HARBORCLIENT_EXPORT_KINDS.includes(value);
}
/**
 * Reads the HarborClient export discriminator from parsed JSON.
 *
 * @param parsed - Parsed JSON payload from an import file.
 * @returns Export kind when recognized, or null when absent or unknown.
 */
export function readHarborclientExport(parsed) {
    if (!parsed || typeof parsed !== 'object') {
        return null;
    }
    const value = parsed.harborclientExport;
    if (typeof value !== 'string' || !isHarborclientExportKind(value)) {
        return null;
    }
    return value;
}
//# sourceMappingURL=harborclientExport.js.map