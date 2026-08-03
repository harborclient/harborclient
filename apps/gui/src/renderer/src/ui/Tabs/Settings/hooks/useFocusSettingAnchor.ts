import { useEffect } from 'react';

import { focusSettingAnchor } from '../settingAnchorId';

/**
 * Scrolls and focuses a catalog setting anchor when `focusSettingId` is set.
 *
 * Runs after paint so the target field/group is mounted. Calls
 * `onFocusSettingHandled` after a successful or attempted focus so callers can
 * clear pending focus state.
 *
 * @param focusSettingId - Catalog id to focus, or undefined when idle.
 * @param onFocusSettingHandled - Optional callback after the focus attempt.
 */
export function useFocusSettingAnchor(
  focusSettingId: string | undefined,
  onFocusSettingHandled?: () => void
): void {
  /**
   * Focuses the pending setting anchor once the section content is in the DOM.
   */
  useEffect(() => {
    if (focusSettingId == null || focusSettingId.length === 0) {
      return;
    }

    requestAnimationFrame(() => {
      focusSettingAnchor(focusSettingId);
      onFocusSettingHandled?.();
    });
  }, [focusSettingId, onFocusSettingHandled]);
}
