import { parseCustomThemeSource } from '@harborclient/core/plugin/customThemeExport';
import { parsePluginThemeValue } from '@harborclient/core/plugin/types';
import type { BuiltinThemeId } from '@harborclient/core/builtinThemes';
import { isBuiltinThemeSource } from '@harborclient/core/builtinThemes';
import type { CustomThemeType } from '@harborclient/core/types/customTheme';
import type { ThemeSource } from '@harborclient/core/types';
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
 * @param token - Theme color or metric token without the `--mac-` prefix.
 */
function toCssVariable(token: string): string {
  return `--mac-${token}`;
}

/**
 * Formats color and metric token maps as CSS custom-property declarations.
 *
 * @param colors - Color token overrides without the `--mac-` prefix.
 * @param metrics - Optional metric token overrides without the `--mac-` prefix.
 * @returns Newline-joined declaration lines (including leading indentation).
 */
function tokenDeclarations(
  colors: Record<string, string>,
  metrics?: Record<string, string>
): string {
  return Object.entries({ ...colors, ...(metrics ?? {}) })
    .map(([token, value]) => `  ${toCssVariable(token)}: ${value};`)
    .join('\n');
}

/**
 * Builds CSS for custom theme token overrides.
 *
 * @param colors - Color token overrides without the `--mac-` prefix.
 * @param type - Base appearance mode for color-scheme.
 * @param stylesheet - Optional raw CSS appended after token overrides.
 * @param metrics - Optional metric token overrides without the `--mac-` prefix.
 */
export function buildCustomThemeCss(
  colors: Record<string, string>,
  type: CustomThemeType,
  stylesheet?: string,
  metrics?: Record<string, string>
): string {
  const colorScheme = type === 'light' ? 'light' : 'dark';
  const declarations = tokenDeclarations(colors, metrics);
  const rootBlock = `:root[data-theme='custom'] {\n  color-scheme: ${colorScheme};\n${declarations}\n}\n`;
  const stylesheetBlock = stylesheet && stylesheet.trim().length > 0 ? `\n${stylesheet}\n` : '';
  return `${rootBlock}${stylesheetBlock}`;
}

/**
 * Builds CSS for built-in theme token overrides loaded from JSON palettes.
 *
 * @param colors - Color token overrides without the `--mac-` prefix.
 * @param dataTheme - Semantic root theme attribute for the built-in palette.
 * @param type - Base appearance mode for color-scheme.
 * @param metrics - Optional metric token overrides without the `--mac-` prefix.
 */
export function buildBuiltinThemeCss(
  colors: Record<string, string>,
  dataTheme: BuiltinThemeId,
  type: CustomThemeType,
  metrics?: Record<string, string>
): string {
  const colorScheme = type === 'light' ? 'light' : 'dark';
  const declarations = tokenDeclarations(colors, metrics);
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
 * @param colors - Color token overrides without the `--mac-` prefix.
 * @param type - Base appearance mode for color-scheme.
 * @param stylesheet - Optional raw CSS appended after token overrides.
 * @param metrics - Optional metric token overrides without the `--mac-` prefix.
 */
export function applyCustomThemeColors(
  colors: Record<string, string>,
  type: CustomThemeType,
  stylesheet?: string,
  metrics?: Record<string, string>
): void {
  document.documentElement.setAttribute('data-theme', 'custom');
  clearInjectedThemeStyle();

  const css = buildCustomThemeCss(colors, type, stylesheet, metrics);
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
 * @param colors - Color token overrides without the `--mac-` prefix.
 * @param type - Base appearance mode for color-scheme.
 * @param dataTheme - Semantic built-in theme attribute value.
 * @param metrics - Optional metric token overrides without the `--mac-` prefix.
 */
export function applyBuiltinThemeColors(
  colors: Record<string, string>,
  type: CustomThemeType,
  dataTheme: BuiltinThemeId,
  metrics?: Record<string, string>
): void {
  document.documentElement.setAttribute('data-theme', dataTheme);
  clearInjectedThemeStyle();

  const css = buildBuiltinThemeCss(colors, dataTheme, type, metrics);
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
 * @param colors - Optional color token overrides.
 * @param stylesheet - Optional raw CSS appended after token overrides.
 * @param metrics - Optional metric token overrides.
 */
function buildThemeCss(
  pluginId: string,
  themeId: string,
  colors?: Record<string, string>,
  stylesheet?: string,
  metrics?: Record<string, string>
): string {
  const selector = `:root[data-theme='plugin-${pluginId}-${themeId}']`;
  const declarations = tokenDeclarations(colors ?? {}, metrics);
  const rootBlock = declarations ? `${selector} {\n${declarations}\n}\n` : '';
  const stylesheetBlock = stylesheet && stylesheet.trim().length > 0 ? `\n${stylesheet}\n` : '';
  return `${rootBlock}${stylesheetBlock}`;
}

/**
 * Returns whether a stylesheet value looks like a plugin-relative CSS filename.
 *
 * Inlined CSS (from theme import JSON) contains newlines or `{` and must be
 * applied as literal text rather than loaded via `readPluginAsset`.
 *
 * @param stylesheet - Candidate stylesheet path or inlined CSS text.
 * @returns True when the value should be read as a plugin asset file.
 */
export function isPluginStylesheetFilename(stylesheet: string): boolean {
  const trimmed = stylesheet.trim();
  if (!trimmed || trimmed.includes('\n') || trimmed.includes('{')) {
    return false;
  }
  return /\.css$/i.test(trimmed) && trimmed.length < 512;
}

/**
 * Resolves stylesheet text from either a plugin-relative `.css` path or inlined CSS.
 *
 * @param pluginId - Plugin manifest id.
 * @param stylesheet - Filename or already-inlined CSS.
 * @returns CSS text to inject, or empty string when unavailable.
 */
async function resolvePluginStylesheetText(pluginId: string, stylesheet: string): Promise<string> {
  if (!isPluginStylesheetFilename(stylesheet)) {
    return stylesheet;
  }

  try {
    const asset = await window.api.readPluginAsset(pluginId, stylesheet.trim());
    return atob(asset.content);
  } catch {
    return '';
  }
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

  const stylesheetText = theme.stylesheet
    ? await resolvePluginStylesheetText(pluginId, theme.stylesheet)
    : '';

  const css = buildThemeCss(pluginId, themeId, theme.colors, stylesheetText, theme.metrics);
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

  applyBuiltinThemeColors(stored.colors, stored.type, effectiveTheme, stored.metrics);
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

    applyCustomThemeColors(
      customTheme.colors,
      customTheme.type,
      customTheme.stylesheet,
      customTheme.metrics
    );
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
