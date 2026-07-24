import { formatPluginThemeValue } from '#/shared/plugin/types';
import type { RegisteredPluginTheme } from '#/shared/plugin/types';

/** localStorage key for theme prompt deduplication across app restarts. */
export const PROMPTED_THEMES_STORAGE_KEY = 'harborclient:promptedPluginThemes';

/**
 * Builds a stable key for one plugin theme prompt entry.
 *
 * @param pluginId - Plugin manifest id.
 * @param themeId - Theme id within the plugin manifest.
 * @returns Dedupe key stored in localStorage.
 */
export function themePromptKey(pluginId: string, themeId: string): string {
  return `${pluginId}:${themeId}`;
}

/**
 * Reads the set of plugin theme keys the user has already been prompted for.
 *
 * @returns Parsed keys from localStorage, or an empty set when unset or invalid.
 */
export function readPromptedThemeKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(PROMPTED_THEMES_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((entry): entry is string => typeof entry === 'string'));
  } catch {
    return new Set();
  }
}

/**
 * Persists one theme key as already prompted after the user accepts or dismisses.
 *
 * @param key - Dedupe key from {@link themePromptKey}.
 */
export function markThemePrompted(key: string): void {
  const prompted = readPromptedThemeKeys();
  prompted.add(key);
  localStorage.setItem(PROMPTED_THEMES_STORAGE_KEY, JSON.stringify([...prompted]));
}

/**
 * Returns whether the persisted theme preference already matches one plugin theme.
 *
 * @param activeTheme - Persisted theme preference from the main process.
 * @param pluginId - Plugin manifest id.
 * @param themeId - Theme id within the plugin manifest.
 */
export function isActivePluginTheme(
  activeTheme: string,
  pluginId: string,
  themeId: string
): boolean {
  return activeTheme === formatPluginThemeValue(pluginId, themeId);
}

/**
 * Selects registered plugin themes that should be offered after user-enabled activation.
 *
 * @param pluginThemes - Registered plugin themes from the host registry.
 * @param isPendingPlugin - Returns whether the user just enabled the plugin.
 * @param inFlightKeys - Theme keys currently being offered in another effect run.
 */
export function selectThemePromptCandidates(
  pluginThemes: RegisteredPluginTheme[],
  isPendingPlugin: (pluginId: string) => boolean,
  inFlightKeys: ReadonlySet<string>
): RegisteredPluginTheme[] {
  return pluginThemes.filter((theme) => {
    if (!isPendingPlugin(theme.pluginId)) {
      return false;
    }
    const key = themePromptKey(theme.pluginId, theme.id);
    return !inFlightKeys.has(key);
  });
}
