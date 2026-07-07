import { formatPluginThemeValue } from '#/shared/plugin/types';
import type { ThemeSource } from '#/shared/types';
import { applyThemePreference } from '#/renderer/src/plugins/themeRuntime';

/**
 * Applies a plugin theme preference and persists it through the main-process settings API.
 *
 * @param pluginId - Plugin manifest id.
 * @param themeId - Theme id within the plugin manifest.
 */
export async function applyPluginThemePreference(pluginId: string, themeId: string): Promise<void> {
  const value = formatPluginThemeValue(pluginId, themeId) as ThemeSource;
  await applyThemePreference(value);
  await window.api.setTheme(value);
}
