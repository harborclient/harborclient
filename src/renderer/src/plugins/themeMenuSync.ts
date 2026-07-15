import { formatCustomThemeValue } from '#/shared/plugin/customThemeExport';
import type { ThemeMenuOption } from '#/shared/themes';
import type { ThemeSource } from '#/shared/types';
import { getRegisteredPluginThemes, subscribePluginRegistry } from './registry';
import { formatPluginThemeValue } from '#/shared/plugin/types';

/**
 * Builds custom theme menu options from saved custom themes.
 */
async function buildCustomThemeMenuOptions(): Promise<ThemeMenuOption[]> {
  const themes = await window.api.listCustomThemes();
  return themes
    .filter((theme) => theme.builtin !== true)
    .map((theme) => ({
      value: formatCustomThemeValue(theme.id),
      label: theme.title
    }));
}

/**
 * Builds plugin theme menu options from the renderer plugin registry.
 */
function buildPluginThemeMenuOptions(): ThemeMenuOption[] {
  return getRegisteredPluginThemes().map((entry) => ({
    value: formatPluginThemeValue(entry.pluginId, entry.id) as ThemeSource,
    label: entry.title
  }));
}

/**
 * Pushes active theme and theme options to the main process View menu.
 *
 * @param activeTheme - Persisted appearance theme preference.
 */
async function syncThemeMenuState(activeTheme: ThemeSource): Promise<void> {
  const customThemeOptions = await buildCustomThemeMenuOptions();
  const pluginThemeOptions = buildPluginThemeMenuOptions();
  await window.api.setMenuThemeMenuState(activeTheme, [
    ...customThemeOptions,
    ...pluginThemeOptions
  ]);
}

/**
 * Immediately refreshes the View menu theme list from saved custom and plugin themes.
 */
export async function syncThemeMenuNow(): Promise<void> {
  const activeTheme = await window.api.getTheme();
  await syncThemeMenuState(activeTheme);
}

/**
 * Subscribes to theme and plugin registry changes and keeps the View menu theme list in sync.
 */
export function startThemeMenuSync(): () => void {
  let activeTheme: ThemeSource = 'system';
  let cancelled = false;

  void window.api.getTheme().then((theme) => {
    if (cancelled) {
      return;
    }
    activeTheme = theme;
    void syncThemeMenuState(activeTheme);
  });

  const unsubscribeTheme = window.api.onThemeChanged((theme) => {
    activeTheme = theme;
    void syncThemeMenuState(activeTheme);
  });

  const unsubscribeRegistry = subscribePluginRegistry(() => {
    void syncThemeMenuState(activeTheme);
  });

  return () => {
    cancelled = true;
    unsubscribeTheme();
    unsubscribeRegistry();
  };
}
