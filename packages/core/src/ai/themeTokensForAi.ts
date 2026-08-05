import { isBuiltinThemeId, isBuiltinThemeSource, type BuiltinThemeId } from '../builtinThemes.js';
import { parseCustomThemeSource } from '../plugin/customThemeExport.js';
import { parsePluginThemeValue } from '../plugin/types.js';
import type { CustomTheme } from '../types/customTheme.js';
import type { ThemeColorToken, ThemeMetricToken } from '@harborclient/sdk';
import {
  getThemeTokenCatalogEntry,
  normalizeThemeTokenInput,
  type ThemeTokenCatalogEntry
} from '../theme/themeTokenCatalog.js';

/**
 * Result of resolving the on-disk theme file that owns the active appearance.
 */
export interface ResolvedActiveThemeFile {
  /**
   * Persisted theme preference (`light`, `custom:…`, `system`, etc.).
   */
  activeTheme: string;

  /**
   * Filename stem under `{userData}/custom_themes`.
   */
  themeId: string;

  /**
   * Effective built-in id when the preference is system or a built-in source.
   */
  builtinId?: BuiltinThemeId;
}

/**
 * Successful patch payload for persisting one token onto a custom theme.
 */
export interface ThemeTokenPatchSuccess {
  /**
   * Catalog entry for the updated token.
   */
  entry: ThemeTokenCatalogEntry;

  /**
   * Value stored on disk before the patch (or built-in default when unset).
   */
  previousValue: string;

  /**
   * New CSS value to persist.
   */
  value: string;

  /**
   * Updated colors map for saveCustomTheme.
   */
  colors: CustomTheme['colors'];

  /**
   * Updated metrics map for saveCustomTheme.
   */
  metrics: CustomTheme['metrics'];
}

/**
 * Resolves which on-disk theme file an update should target for the active preference.
 *
 * Plugin themes cannot be written. Built-in and system themes map to their seeded
 * `{userData}/custom_themes/<id>.json` files. Custom themes use `custom:<id>`.
 *
 * @param activeTheme - Persisted theme preference from `getTheme()`.
 * @param resolveSystemBuiltinId - Returns the effective built-in id for `system`.
 * @returns Resolved theme file ids, or an error string.
 */
export function resolveActiveThemeFileForUpdate(
  activeTheme: string,
  resolveSystemBuiltinId: () => BuiltinThemeId
): ResolvedActiveThemeFile | { error: string } {
  if (parsePluginThemeValue(activeTheme)) {
    return {
      error:
        'The active theme is a plugin theme and cannot be modified with update_theme_token. Switch to a built-in or custom theme first.'
    };
  }

  const custom = parseCustomThemeSource(activeTheme);
  if (custom) {
    return { activeTheme, themeId: custom.id };
  }

  if (activeTheme === 'system') {
    const builtinId = resolveSystemBuiltinId();
    return { activeTheme, themeId: builtinId, builtinId };
  }

  if (isBuiltinThemeSource(activeTheme)) {
    return { activeTheme, themeId: activeTheme, builtinId: activeTheme };
  }

  if (isBuiltinThemeId(activeTheme)) {
    return { activeTheme, themeId: activeTheme, builtinId: activeTheme };
  }

  return {
    error: `Unsupported active theme preference for updates: ${activeTheme}`
  };
}

/**
 * Builds a colors/metrics patch for one catalog token on an existing theme record.
 *
 * @param theme - Loaded custom theme from disk.
 * @param tokenInput - Bare token id or `--mac-*` name from the agent.
 * @param value - New CSS value.
 * @returns Patch fields or an error string.
 */
export function buildThemeTokenPatch(
  theme: CustomTheme,
  tokenInput: string,
  value: string
): ThemeTokenPatchSuccess | { error: string } {
  let token: string;
  try {
    token = normalizeThemeTokenInput(tokenInput);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown theme token.' };
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return { error: 'Provide a non-empty CSS value for the theme token.' };
  }

  const entry = getThemeTokenCatalogEntry(token);
  if (!entry) {
    return { error: `Unknown theme token: ${tokenInput}` };
  }

  const defaults =
    theme.type === 'light'
      ? entry.defaults.light
      : theme.type === 'high-contrast'
        ? entry.defaults.highContrast
        : entry.defaults.dark;

  if (entry.kind === 'color') {
    const colorToken = entry.token as ThemeColorToken;
    const previousValue = theme.colors[colorToken] ?? defaults;
    return {
      entry,
      previousValue,
      value: trimmedValue,
      colors: { ...theme.colors, [colorToken]: trimmedValue },
      metrics: theme.metrics
    };
  }

  const metricToken = entry.token as ThemeMetricToken;
  const previousValue = theme.metrics?.[metricToken] ?? defaults;
  return {
    entry,
    previousValue,
    value: trimmedValue,
    colors: theme.colors,
    metrics: { ...(theme.metrics ?? {}), [metricToken]: trimmedValue }
  };
}
