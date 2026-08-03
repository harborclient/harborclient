/**
 * Builds a stable DOM id for a catalog setting or group anchor.
 *
 * @param settingId - Catalog setting or group id.
 */
export function settingAnchorId(settingId: string): string {
  return `setting-${settingId.replaceAll('.', '-')}`;
}

/**
 * Scrolls a catalog setting anchor into view and focuses it when present.
 *
 * @param settingId - Catalog field or group id whose DOM anchor should be focused.
 * @returns True when an element for the id was found.
 */
export function focusSettingAnchor(settingId: string): boolean {
  const element = document.getElementById(settingAnchorId(settingId));
  if (element == null) {
    return false;
  }

  element.scrollIntoView({ block: 'start' });
  if (typeof element.focus === 'function') {
    element.focus({ preventScroll: true });
  }
  return true;
}
