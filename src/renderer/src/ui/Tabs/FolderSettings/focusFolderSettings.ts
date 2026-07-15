/** DOM id for the folder settings name input. */
export const FOLDER_SETTINGS_NAME_INPUT_ID = 'folder-settings-name';

/**
 * Focuses the folder settings name field after the page tab mounts.
 */
export function focusFolderSettings(): void {
  requestAnimationFrame(() => {
    document.getElementById(FOLDER_SETTINGS_NAME_INPUT_ID)?.focus();
  });
}
