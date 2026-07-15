/** Stable id of the environment name input on the environment settings page. */
export const ENVIRONMENT_SETTINGS_NAME_INPUT_ID = 'environment-settings-name';

/**
 * Focuses the environment settings name field and selects its full value.
 *
 * Waits two animation frames so React can mount the settings page tab after
 * `openPageTab`. No-ops when the input is not mounted.
 */
export function focusEnvironmentSettings(): void {
  /**
   * Waits two animation frames so React can mount the environment settings form.
   */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const input = document.getElementById(ENVIRONMENT_SETTINGS_NAME_INPUT_ID);
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
