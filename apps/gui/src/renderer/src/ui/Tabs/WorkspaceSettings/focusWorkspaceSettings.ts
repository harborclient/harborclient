/** Stable id of the workspace name input on the workspace settings page. */
export const WORKSPACE_SETTINGS_NAME_INPUT_ID = 'workspace-settings-name';

/** Stable id of the open-with environment select on the workspace settings page. */
export const WORKSPACE_SETTINGS_ENVIRONMENT_SELECT_ID = 'workspace-settings-environment';

/**
 * Focuses the workspace settings name field and selects its full value.
 *
 * Waits two animation frames so React can mount the settings page tab after
 * `openPageTab`. No-ops when the input is not mounted.
 */
export function focusWorkspaceSettings(): void {
  /**
   * Waits two animation frames so React can mount the workspace settings form.
   */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const input = document.getElementById(WORKSPACE_SETTINGS_NAME_INPUT_ID);
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
