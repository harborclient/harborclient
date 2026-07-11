/**
 * Builds a stable DOM id for a catalog setting or group anchor.
 *
 * @param settingId - Catalog setting or group id.
 */
export function settingAnchorId(settingId: string): string {
  return `setting-${settingId.replaceAll('.', '-')}`;
}
