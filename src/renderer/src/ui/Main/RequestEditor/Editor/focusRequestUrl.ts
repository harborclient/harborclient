import type { AppDispatch } from '#/renderer/src/store/redux';
import { setShowRequestEditor } from '#/renderer/src/store/slices/navigationSlice';

/** Stable id of the request URL input in the active request tab. */
export const REQUEST_URL_INPUT_ID = 'request-url';

/**
 * Focuses the request URL field and selects its full value for quick replacement.
 *
 * Ensures the request editor panel is visible before focusing. No-ops when the
 * URL input is not mounted (for example on a settings page tab).
 *
 * @param dispatch - Redux dispatch used to reveal the request editor.
 */
export function focusRequestUrl(dispatch: AppDispatch): void {
  dispatch(setShowRequestEditor(true));

  /**
   * Waits two animation frames so React can mount the request URL input.
   */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const input = document.getElementById(REQUEST_URL_INPUT_ID);
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
