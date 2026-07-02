/** Stable id of the collection name input on the General settings tab. */
export const COLLECTION_SETTINGS_NAME_INPUT_ID = 'collection-settings-name';

/**
 * Focuses the collection settings name field and selects its full value.
 *
 * Waits two animation frames so React can mount the settings page tab after
 * `openPageTab`. No-ops when the input is not mounted.
 */
export function focusCollectionSettings(): void {
  /**
   * Waits two animation frames so React can mount the collection settings form.
   */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const input = document.getElementById(COLLECTION_SETTINGS_NAME_INPUT_ID);
      if (
        input == null ||
        !('select' in input) ||
        typeof input.focus !== 'function' ||
        typeof input.select !== 'function'
      ) {
        return;
      }

      input.focus();
      input.select();
    });
  });
}
