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
 * Applies `data-theme` and injected theme CSS without removing the previous
 * stylesheet node first. That avoids a one-frame unstyled paint when plugins
 * reload and re-apply the same (or updated) theme.
 *
 * @param dataTheme - Root `data-theme` value, or null to remove the attribute.
 * @param css - Full stylesheet text to inject, or empty to remove the style node.
 */
function applyThemeDocumentState(dataTheme: string | null, css: string): void {
  const root = document.documentElement;
  const previousTheme = root.getAttribute('data-theme');
  const themeChanged = dataTheme === null ? previousTheme !== null : previousTheme !== dataTheme;

  if (dataTheme === null) {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', dataTheme);
  }

  const existing = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  const nextCss = css.trim();
  let styleChanged = false;

  if (!nextCss) {
    if (existing) {
      existing.remove();
      styleChanged = true;
    }
  } else if (existing) {
    if (existing.textContent !== nextCss) {
      existing.textContent = nextCss;
      styleChanged = true;
    }
  } else {
    const style = document.createElement('style');
    style.id = STYLE_ELEMENT_ID;
    style.textContent = nextCss;
    document.head.appendChild(style);
    styleChanged = true;
  }

  if (themeChanged || styleChanged) {
    notifyThemeColorsApplied();
  }
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
  applyThemeDocumentState('custom', buildCustomThemeCss(colors, type, stylesheet, metrics));
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
  applyThemeDocumentState(dataTheme, buildBuiltinThemeCss(colors, dataTheme, type, metrics));
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
 * Resolves stylesheet text before mutating the document so the previous theme
 * CSS stays visible until the replacement is ready.
 *
 * @param pluginId - Plugin manifest id.
 * @param themeId - Theme id within the plugin.
 */
export async function applyPluginTheme(pluginId: string, themeId: string): Promise<void> {
  const theme = getRegisteredPluginThemes().find(
    (entry) => entry.pluginId === pluginId && entry.id === themeId
  );
  if (!theme) {
    applyThemeDocumentState(null, '');
    return;
  }

  const stylesheetText = theme.stylesheet
    ? await resolvePluginStylesheetText(pluginId, theme.stylesheet)
    : '';

  const css = buildThemeCss(pluginId, themeId, theme.colors, stylesheetText, theme.metrics);
  applyThemeDocumentState(`plugin-${pluginId}-${themeId}`, css);
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
    // Resolve the attribute first so we can clear/inject style without a gap
    // where both data-theme and overrides are missing.
    applyThemeAttribute(theme);
    const nextTheme = document.documentElement.getAttribute('data-theme');
    applyThemeDocumentState(nextTheme, '');
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
      applyThemeDocumentState(null, '');
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

  applyThemeAttribute(theme as ThemeSource);
  const nextTheme = document.documentElement.getAttribute('data-theme');
  applyThemeDocumentState(nextTheme, '');
}
