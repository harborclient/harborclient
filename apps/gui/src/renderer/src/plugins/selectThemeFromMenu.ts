import type { ThemeSource } from '@harborclient/core/types';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { patchGeneralSettings } from '#/renderer/src/store/thunks';
import { applyThemePreference } from '#/renderer/src/plugins/themeRuntime';
import { formatErrorMessage, showAlert, showConfirm } from '#/renderer/src/ui/Modals/dialogHelpers';

/**
 * Applies a theme selection from the View menu or Action palette, optionally
 * confirming when the user has theme-switch warnings enabled.
 *
 * @param dispatch - Redux dispatch for confirm dialogs and settings patches.
 * @param getState - Reads `warnWhenSwitchingThemes` from general settings.
 * @param theme - Theme preference value to apply.
 * @param label - Human-readable theme label used in the confirmation copy.
 */
export async function selectThemeFromMenu(
  dispatch: AppDispatch,
  getState: () => RootState,
  theme: ThemeSource,
  label: string
): Promise<void> {
  const activeTheme = await window.api.getTheme();
  if (theme === activeTheme) {
    return;
  }

  const warnWhenSwitchingThemes = getState().settings.general.warnWhenSwitchingThemes;

  if (warnWhenSwitchingThemes) {
    const result = await showConfirm(dispatch, {
      title: 'Switch theme?',
      message: `Switch appearance to ${label}?`,
      confirmLabel: 'Switch theme',
      checkboxLabel: 'Do not ask again'
    });
    if (!result.confirmed) {
      return;
    }
    if (result.checkboxChecked) {
      await dispatch(patchGeneralSettings({ warnWhenSwitchingThemes: false }));
    }
  }

  try {
    await applyThemePreference(theme);
    await window.api.setTheme(theme);
  } catch (err: unknown) {
    showAlert(dispatch, formatErrorMessage(err, 'Failed to switch theme'));
  }
}
