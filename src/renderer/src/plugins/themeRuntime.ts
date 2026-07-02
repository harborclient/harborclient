import { parsePluginThemeValue } from '#/shared/plugin/types';
import type { ThemeSource } from '#/shared/types';
import { getRegisteredPluginThemes } from '#/renderer/src/plugins/registry';
import { applyThemeAttribute } from '#/renderer/src/theme';

const STYLE_ELEMENT_ID = 'harborclient-plugin-theme-style';

/**
 * Maps theme token keys to --mac-* CSS custom property names.
 *
 * @param token - Theme color token without the `--mac-` prefix.
 */
function toCssVariable(token: string): string {
  return `--mac-${token}`;
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
 * Removes injected plugin theme CSS from the document.
 */
function clearInjectedThemeStyle(): void {
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
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
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Re-applies the persisted theme, falling back to System when a plugin theme is unavailable.
 */
export async function applyPersistedPluginTheme(): Promise<void> {
  const theme = await window.api.getTheme();
  const parsed = parsePluginThemeValue(theme);
  if (!parsed) {
    clearInjectedThemeStyle();
    applyThemeAttribute(theme);
    return;
  }

  const registered = getRegisteredPluginThemes().some(
    (entry) => entry.pluginId === parsed.pluginId && entry.id === parsed.themeId
  );
  if (!registered) {
    clearInjectedThemeStyle();
    document.documentElement.removeAttribute('data-theme');
    await window.api.setTheme('system');
    return;
  }

  await applyPluginTheme(parsed.pluginId, parsed.themeId);
}

/**
 * Applies a theme preference from Settings, including built-in and plugin themes.
 *
 * @param theme - Persisted theme preference.
 */
export async function applyThemePreference(theme: string): Promise<void> {
  const parsed = parsePluginThemeValue(theme);
  if (parsed) {
    await applyPluginTheme(parsed.pluginId, parsed.themeId);
    return;
  }

  clearInjectedThemeStyle();
  applyThemeAttribute(theme as ThemeSource);
}
