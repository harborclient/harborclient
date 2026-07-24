import type { ThemeColorToken } from '@harborclient/sdk';
import { parseCustomThemeSource } from '#/shared/plugin/customThemeExport';
import { parsePluginThemeValue } from '#/shared/plugin/types';
import { CUSTOM_THEME_TOKENS } from '#/shared/types/customTheme';
import type { CustomThemeType } from '#/shared/types/customTheme';
import type { ThemeSource } from '#/shared/types/settings';
import { getRegisteredPluginThemes } from '#/renderer/src/plugins/registry';
import { shouldUseHighContrastTheme } from '#/renderer/src/theme';
import { getDefaultCustomThemePalette } from './customThemeDefaults';

/**
 * Maps a theme color token to its `--mac-*` CSS custom property name.
 *
 * @param token - Theme color token without the `--mac-` prefix.
 */
function toCssVariable(token: ThemeColorToken): string {
  return `--mac-${token}`;
}

/**
 * Reads the currently applied theme palette from resolved `--mac-*` values on `:root`.
 *
 * @param fallbackType - Base appearance used for per-token defaults when a value is missing.
 * @returns Token overrides suitable for seeding a new Designer draft.
 */
export function readActiveThemePalette(
  fallbackType: CustomThemeType
): Partial<Record<ThemeColorToken, string>> {
  const computed = getComputedStyle(document.documentElement);
  const fallback = getDefaultCustomThemePalette(fallbackType);
  const colors: Partial<Record<ThemeColorToken, string>> = {};

  for (const token of CUSTOM_THEME_TOKENS) {
    const value = computed.getPropertyValue(toCssVariable(token)).trim();
    colors[token] = value.length > 0 ? value : fallback[token];
  }

  return colors;
}

/**
 * Infers the Designer appearance mode from a persisted theme preference.
 *
 * @param theme - Active theme source from settings.
 * @returns Base appearance mode for the Designer form.
 */
export async function inferActiveThemeType(theme: ThemeSource): Promise<CustomThemeType> {
  if (theme === 'light' || theme === 'dark' || theme === 'high-contrast') {
    return theme;
  }

  const customTheme = parseCustomThemeSource(theme);
  if (customTheme) {
    const stored = await window.api.getCustomTheme(customTheme.id);
    return stored?.type ?? 'dark';
  }

  const pluginTheme = parsePluginThemeValue(theme);
  if (pluginTheme) {
    const registered = getRegisteredPluginThemes().find(
      (entry) => entry.pluginId === pluginTheme.pluginId && entry.id === pluginTheme.themeId
    );
    if (registered?.type === 'light' || registered?.type === 'high-contrast') {
      return registered.type;
    }
    return 'dark';
  }

  if (shouldUseHighContrastTheme('system')) {
    return 'high-contrast';
  }

  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }

  return 'light';
}
