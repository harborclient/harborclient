import {
  BUILTIN_THEME_IDS,
  BUILTIN_THEME_TITLES,
  BUILTIN_THEME_TYPES,
  type BuiltinThemeId
} from '../builtinThemes.js';
import { formatCustomThemeValue } from '../plugin/customThemeExport.js';
import { formatPluginThemeValue } from '../plugin/types.js';
import type { CustomTheme, CustomThemeType } from '../types/customTheme.js';
import type { ThemeSource } from '../types/settings.js';

/**
 * Origin of a selectable appearance theme.
 *
 * `system` follows the OS light/dark preference and therefore has no fixed
 * appearance `type` of its own.
 */
export type AiThemeKind = 'system' | 'builtin' | 'custom' | 'plugin';

/**
 * One appearance theme the agent can inspect or activate.
 */
export interface AiThemeOption {
  /**
   * Persisted `ThemeSource` value passed back to `set_theme`.
   */
  value: ThemeSource;

  /**
   * Human-readable title shown in the View menu.
   */
  label: string;

  /**
   * Where the theme comes from.
   */
  kind: AiThemeKind;

  /**
   * Base light/dark appearance; omitted for `system`, which follows the OS.
   */
  type?: CustomThemeType;

  /**
   * True when this theme is the current appearance preference.
   */
  isActive: boolean;
}

/**
 * Raw theme sources the renderer collects before building the agent list.
 */
export interface AiThemeInventory {
  /**
   * Persisted preference from `theme:get`.
   */
  activeTheme: string;

  /**
   * Saved themes under `{userData}/custom_themes`, including seeded built-ins.
   */
  customThemes: readonly Pick<CustomTheme, 'id' | 'title' | 'type' | 'builtin'>[];

  /**
   * Themes contributed by installed and enabled plugins.
   */
  pluginThemes: readonly { pluginId: string; id: string; title: string }[];
}

/**
 * Builds the ordered list of appearance themes available to the agent.
 *
 * Mirrors the View menu: `system` first, then the three built-ins, then saved
 * custom themes, then plugin-contributed themes. Seeded built-in records are
 * filtered out of the custom group so `light` is not listed twice — the same
 * rule the View menu applies in `themeMenuSync`.
 *
 * @param inventory - Active preference plus saved custom and plugin themes.
 * @returns Ordered options, each flagged with whether it is currently active.
 */
export function listThemesForAi(inventory: AiThemeInventory): AiThemeOption[] {
  const options: AiThemeOption[] = [
    { value: 'system', label: 'System', kind: 'system', isActive: false }
  ];

  for (const id of BUILTIN_THEME_IDS) {
    options.push({
      value: id satisfies BuiltinThemeId,
      label: BUILTIN_THEME_TITLES[id],
      kind: 'builtin',
      type: BUILTIN_THEME_TYPES[id],
      isActive: false
    });
  }

  for (const theme of inventory.customThemes) {
    if (theme.builtin === true) {
      continue;
    }
    options.push({
      value: formatCustomThemeValue(theme.id),
      label: theme.title,
      kind: 'custom',
      type: theme.type,
      isActive: false
    });
  }

  for (const theme of inventory.pluginThemes) {
    options.push({
      value: formatPluginThemeValue(theme.pluginId, theme.id) as ThemeSource,
      label: theme.title,
      kind: 'plugin',
      isActive: false
    });
  }

  return options.map((option) => ({
    ...option,
    isActive: option.value === inventory.activeTheme
  }));
}

/**
 * Strips conversational suffixes so "light theme" and "dark mode" still match.
 *
 * @param input - Lowercased, trimmed theme name from the model.
 * @returns The input without a trailing `theme`, `mode`, or `appearance` word.
 */
function stripThemeSuffix(input: string): string {
  return input.replace(/\s+(theme|mode|appearance)$/, '').trim();
}

/**
 * Resolves a theme name or `ThemeSource` value against the available themes.
 *
 * Accepts the exact persisted value (`dark`, `custom:ocean`) or the display
 * label (`Ocean`), both case-insensitively, and tolerates a trailing "theme" /
 * "mode" word. Ambiguous labels are rejected rather than guessed so the agent
 * cannot silently activate the wrong theme.
 *
 * @param input - Theme name or value supplied by the model.
 * @param options - Available themes from {@link listThemesForAi}.
 * @returns The matched option, or an error naming the valid values.
 */
export function resolveThemeSelection(
  input: string,
  options: readonly AiThemeOption[]
): AiThemeOption | { error: string } {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { error: 'Provide a theme name or value. Call list_themes to see the options.' };
  }

  const exact = options.find((option) => option.value === trimmed);
  if (exact) {
    return exact;
  }

  const needle = stripThemeSuffix(trimmed.toLowerCase());
  const matches = options.filter(
    (option) =>
      option.value.toLowerCase() === needle || option.label.trim().toLowerCase() === needle
  );

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    return {
      error: `"${trimmed}" matches more than one theme (${matches
        .map((option) => option.value)
        .join(', ')}). Retry with the exact value.`
    };
  }

  return {
    error: `Unknown theme: ${trimmed}. Available themes: ${options
      .map((option) => option.value)
      .join(', ')}.`
  };
}
