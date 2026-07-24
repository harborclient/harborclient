import type { CustomThemeType } from '#/shared/types/customTheme';

/**
 * Reserved filename stems for built-in appearance themes stored under
 * `{userData}/custom_themes`.
 */
export const BUILTIN_THEME_IDS = ['light', 'dark', 'high-contrast'] as const;

/**
 * Built-in theme id type matching persisted `ThemeSource` values.
 */
export type BuiltinThemeId = (typeof BUILTIN_THEME_IDS)[number];

/**
 * Human-readable labels for built-in themes shown in Installed cards.
 */
export const BUILTIN_THEME_TITLES: Record<BuiltinThemeId, string> = {
  'light': 'Light',
  'dark': 'Dark',
  'high-contrast': 'High contrast'
};

/**
 * Base appearance mode for each built-in theme id.
 */
export const BUILTIN_THEME_TYPES: Record<BuiltinThemeId, CustomThemeType> = {
  'light': 'light',
  'dark': 'dark',
  'high-contrast': 'high-contrast'
};

/**
 * Returns whether a theme id is reserved for a built-in appearance theme.
 *
 * @param id - Candidate filename stem.
 * @returns True when the id matches a built-in theme.
 */
export function isBuiltinThemeId(id: string): id is BuiltinThemeId {
  return (BUILTIN_THEME_IDS as readonly string[]).includes(id);
}

/**
 * Returns whether a persisted theme preference refers to a built-in theme.
 *
 * @param theme - Persisted theme preference value.
 * @returns True when the value is a built-in theme source.
 */
export function isBuiltinThemeSource(theme: string): theme is BuiltinThemeId {
  return isBuiltinThemeId(theme);
}
