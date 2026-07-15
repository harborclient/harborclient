import { parseCustomThemeSource } from '#/shared/plugin/customThemeExport';
import { parsePluginThemeValue } from '#/shared/plugin/types';
import type { BuiltinThemeId } from '#/shared/builtinThemes';
import { isBuiltinThemeSource } from '#/shared/builtinThemes';
import type { CustomThemeType } from '#/shared/types/customTheme';
import type { ThemeSource } from '#/shared/types';
import { getRegisteredPluginThemes } from './registry';
import { applyThemeAttribute, resolveSystemBuiltinTheme } from '#/renderer/src/theme';

const STYLE_ELEMENT_ID = 'harborclient-plugin-theme-style';

/**
 * Window event name dispatched whenever `--mac-*` color overrides are applied
 * or removed, so JS-rendered surfaces (like xterm.js canvases) that cache
 * colors at creation time know to re-read tokens and update live.
 */
const THEME_COLORS_APPLIED_EVENT = 'harborclient:theme-colors-applied';

/**
 * Notifies listeners that `--mac-*` theme tokens on `:root` may have changed.
 *
 * Called after every renderer-side theme application (custom, built-in, and
 * plugin themes) so components that cache resolved colors in JavaScript
 * (rather than relying on CSS cascade) can refresh themselves.
 */
function notifyThemeColorsApplied(): void {
  window.dispatchEvent(new Event(THEME_COLORS_APPLIED_EVENT));
}

/**
 * Subscribes to theme color application events.
 *
 * @param listener - Called after theme colors are (re)applied to `:root`.
 * @returns Cleanup function that removes the listener.
 */
export function subscribeThemeColorsApplied(listener: () => void): () => void {
  window.addEventListener(THEME_COLORS_APPLIED_EVENT, listener);
  return () => {
    window.removeEventListener(THEME_COLORS_APPLIED_EVENT, listener);
  };
}

/**
 * Maps theme token keys to --mac-* CSS custom property names.
 *
 * @param token - Theme color token without the `--mac-` prefix.
 */
function toCssVariable(token: string): string {
  return `--mac-${token}`;
}

/**
 * Builds CSS for custom theme token overrides.
 *
 * @param colors - Token overrides without the `--mac-` prefix.
 * @param type - Base appearance mode for color-scheme.
 */
export function buildCustomThemeCss(colors: Record<string, string>, type: CustomThemeType): string {
  const colorScheme = type === 'light' ? 'light' : 'dark';
  const declarations = Object.entries(colors)
    .map(([token, value]) => `  ${toCssVariable(token)}: ${value};`)
    .join('\n');
  return `:root[data-theme='custom'] {\n  color-scheme: ${colorScheme};\n${declarations}\n}\n`;
}

/**
 * Builds CSS for built-in theme token overrides loaded from JSON palettes.
 *
 * @param colors - Token overrides without the `--mac-` prefix.
 * @param dataTheme - Semantic root theme attribute for the built-in palette.
 * @param type - Base appearance mode for color-scheme.
 */
export function buildBuiltinThemeCss(
  colors: Record<string, string>,
  dataTheme: BuiltinThemeId,
  type: CustomThemeType
): string {
  const colorScheme = type === 'light' ? 'light' : 'dark';
  const declarations = Object.entries(colors)
    .map(([token, value]) => `  ${toCssVariable(token)}: ${value};`)
    .join('\n');
  return `:root[data-theme='${dataTheme}'] {\n  color-scheme: ${colorScheme};\n${declarations}\n}\n`;
}

/**
 * Removes injected theme CSS from the document.
 */
function clearInjectedThemeStyle(): void {
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
}

/**
 * Applies a custom theme palette to the document root for live preview or persisted use.
 *
 * @param colors - Token overrides without the `--mac-` prefix.
 * @param type - Base appearance mode for color-scheme.
 */
export function applyCustomThemeColors(
  colors: Record<string, string>,
  type: CustomThemeType
): void {
  document.documentElement.setAttribute('data-theme', 'custom');
  clearInjectedThemeStyle();

  const css = buildCustomThemeCss(colors, type);
  if (!css.trim()) {
    notifyThemeColorsApplied();
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = css;
  document.head.appendChild(style);
  notifyThemeColorsApplied();
}

/**
 * Applies a built-in theme palette from its JSON file while preserving semantic
 * `data-theme` attributes used by accessibility overrides.
 *
 * @param colors - Token overrides without the `--mac-` prefix.
 * @param type - Base appearance mode for color-scheme.
 * @param dataTheme - Semantic built-in theme attribute value.
 */
export function applyBuiltinThemeColors(
  colors: Record<string, string>,
  type: CustomThemeType,
  dataTheme: BuiltinThemeId
): void {
  document.documentElement.setAttribute('data-theme', dataTheme);
  clearInjectedThemeStyle();

  const css = buildBuiltinThemeCss(colors, dataTheme, type);
  if (!css.trim()) {
    notifyThemeColorsApplied();
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = css;
  document.head.appendChild(style);
  notifyThemeColorsApplied();
}

/**
 * Builds CSS for one plugin theme from token overrides and optional stylesheet text.
 *
 * @param pluginId - Plugin manifest id.
 * @param themeId - Theme id within the plugin.
 * @param colors - Optional token overrides.
 * @param stylesheet - Optional raw CSS appended after token overrides.
 */
function buildThemeCss(
  pluginId: string,
  themeId: string,
  colors?: Record<string, string>,
  stylesheet?: string
): string {
  const selector = `:root[data-theme='plugin-${pluginId}-${themeId}']`;
  const declarations = colors
    ? Object.entries(colors)
        .map(([token, value]) => `  ${toCssVariable(token)}: ${value};`)
        .join('\n')
    : '';
  const rootBlock = declarations ? `${selector} {\n${declarations}\n}\n` : '';
  const stylesheetBlock = stylesheet && stylesheet.trim().length > 0 ? `\n${stylesheet}\n` : '';
  return `${rootBlock}${stylesheetBlock}`;
}

/**
 * Applies a plugin theme to the document root and injects CSS overrides.
 *
 * @param pluginId - Plugin manifest id.
 * @param themeId - Theme id within the plugin.
 */
export async function applyPluginTheme(pluginId: string, themeId: string): Promise<void> {
  const theme = getRegisteredPluginThemes().find(
    (entry) => entry.pluginId === pluginId && entry.id === themeId
  );
  if (!theme) {
    document.documentElement.removeAttribute('data-theme');
    clearInjectedThemeStyle();
    notifyThemeColorsApplied();
    return;
  }

  document.documentElement.setAttribute('data-theme', `plugin-${pluginId}-${themeId}`);
  clearInjectedThemeStyle();

  let stylesheetText = theme.stylesheet ?? '';
  if (theme.stylesheet) {
    try {
      const asset = await window.api.readPluginAsset(pluginId, theme.stylesheet);
      stylesheetText = atob(asset.content);
    } catch {
      stylesheetText = '';
    }
  }

  const css = buildThemeCss(pluginId, themeId, theme.colors, stylesheetText);
  if (!css.trim()) {
    notifyThemeColorsApplied();
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = css;
  document.head.appendChild(style);
  notifyThemeColorsApplied();
}

/**
 * Resolves the effective built-in palette id for a persisted theme preference.
 *
 * @param theme - Persisted built-in or system theme preference.
 * @returns Built-in theme id whose JSON palette should be applied.
 */
export function resolveBuiltinThemeId(theme: ThemeSource): BuiltinThemeId {
  if (theme === 'system') {
    return resolveSystemBuiltinTheme();
  }

  if (isBuiltinThemeSource(theme)) {
    return theme;
  }

  return 'light';
}

/**
 * Applies a built-in or system theme preference using its JSON palette.
 *
 * @param theme - Persisted built-in or system theme preference.
 */
async function applyBuiltinThemePreference(theme: ThemeSource): Promise<void> {
  const effectiveTheme = resolveBuiltinThemeId(theme);
  const stored = await window.api.getCustomTheme(effectiveTheme);

  if (!stored) {
    clearInjectedThemeStyle();
    applyThemeAttribute(theme);
    return;
  }

  applyBuiltinThemeColors(stored.colors, stored.type, effectiveTheme);
}

/**
 * Re-applies the persisted theme, falling back to System when a plugin theme is unavailable.
 */
export async function applyPersistedPluginTheme(): Promise<void> {
  const theme = await window.api.getTheme();
  await applyThemePreference(theme);
}

/**
 * Applies a theme preference for live preview without persisting it.
 *
 * Updates renderer CSS overrides and Electron nativeTheme so light/dark/system
 * palettes match the selected card before the user saves.
 *
 * @param theme - Theme source to preview.
 */
export async function previewThemePreference(theme: string): Promise<void> {
  await applyThemePreference(theme);
  await window.api.previewTheme(theme as ThemeSource);
}

/**
 * Applies a theme preference from Settings, including built-in, custom, and plugin themes.
 *
 * @param theme - Persisted theme preference.
 */
export async function applyThemePreference(theme: string): Promise<void> {
  const customParsed = parseCustomThemeSource(theme);
  if (customParsed) {
    const customTheme = await window.api.getCustomTheme(customParsed.id);
    if (!customTheme) {
      clearInjectedThemeStyle();
      document.documentElement.removeAttribute('data-theme');
      await window.api.setTheme('system');
      return;
    }

    applyCustomThemeColors(customTheme.colors, customTheme.type);
    return;
  }

  const parsed = parsePluginThemeValue(theme);
  if (parsed) {
    await applyPluginTheme(parsed.pluginId, parsed.themeId);
    return;
  }

  if (theme === 'light' || theme === 'dark' || theme === 'high-contrast' || theme === 'system') {
    await applyBuiltinThemePreference(theme as ThemeSource);
    return;
  }

  clearInjectedThemeStyle();
  applyThemeAttribute(theme as ThemeSource);
}
