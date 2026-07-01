import { formatPluginThemeValue } from '#/shared/plugin/types';
import type { ThemeMenuOption } from '#/shared/themes';
import type { ThemeSource } from '#/shared/types';
import {
  getRegisteredPluginThemes,
  subscribePluginRegistry
} from '#/renderer/src/plugins/registry';

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
 * Pushes active theme and plugin theme options to the main process View menu.
 *
 * @param activeTheme - Persisted appearance theme preference.
 */
async function syncThemeMenuState(activeTheme: ThemeSource): Promise<void> {
  await window.api.setMenuThemeMenuState(activeTheme, buildPluginThemeMenuOptions());
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
