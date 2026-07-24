import type { ThemeColorToken } from '@harborclient/sdk';
/**
 * Base appearance mode for a user-authored custom theme.
 */
export type CustomThemeType = 'light' | 'dark' | 'high-contrast';
/**
 * User-authored theme stored under `{userData}/custom_themes/<id>.json`.
 */
export interface CustomTheme {
  /**
   * Stable filename stem for the on-disk export file.
   */
  id: string;
  /**
   * Human-readable label shown on Installed cards and in menus.
   */
  title: string;
  /**
   * Base appearance for `color-scheme` and Electron native window chrome.
   */
  type: CustomThemeType;
  /**
   * Token overrides without the `--mac-` prefix.
   */
  colors: Partial<Record<ThemeColorToken, string>>;
  /**
   * Optional extra CSS appended after token overrides when the theme is applied.
   */
  stylesheet?: string;
  /**
   * True when this record is a reserved built-in theme that cannot be uninstalled.
   */
  builtin?: boolean;
}
/**
 * Portable custom theme export file format.
 */
export interface CustomThemeExport {
  /**
   * HarborClient export schema version for forward compatibility.
   */
  harborclientVersion: 1;
  /**
   * Discriminator identifying this file as a theme export.
   */
  harborclientExport: 'theme';
  /**
   * Token overrides without the `--mac-` prefix.
   */
  theme: Partial<Record<ThemeColorToken, string>>;
  /**
   * Human-readable theme title.
   */
  title: string;
  /**
   * Base appearance mode for the theme.
   */
  type: CustomThemeType;
  /**
   * Optional extra CSS: either a plugin-relative stylesheet filename (e.g.
   * `styles.css`) or the inlined CSS text after HarborClient's first read.
   */
  stylesheet?: string;
}
/**
 * Result of importing a theme export file without saving it.
 */
export interface CustomThemeImportDraft {
  /**
   * Imported theme title.
   */
  title: string;
  /**
   * Imported base appearance mode.
   */
  type: CustomThemeType;
  /**
   * Imported token overrides.
   */
  colors: Partial<Record<ThemeColorToken, string>>;
  /**
   * Optional extra CSS from the import envelope.
   */
  stylesheet?: string;
}
/**
 * One labeled group of theme color tokens for the Designer grid.
 */
export interface CustomThemeTokenGroup {
  /**
   * Section heading shown above a token group.
   */
  label: string;
  /**
   * Ordered token keys in this group.
   */
  tokens: ThemeColorToken[];
}
/**
 * Human-readable labels for each theme color token in the Designer grid.
 */
export declare const CUSTOM_THEME_TOKEN_LABELS: Record<ThemeColorToken, string>;
/**
 * Ordered token groups for the Designer color grid.
 */
export declare const CUSTOM_THEME_TOKEN_GROUPS: CustomThemeTokenGroup[];
/**
 * All theme color tokens in display order for the Designer grid.
 */
export declare const CUSTOM_THEME_TOKENS: ThemeColorToken[];
/**
 * Key palette tokens used for the 4x4 swatch preview on Installed cards.
 */
export declare const CUSTOM_THEME_SWATCH_TOKENS: ThemeColorToken[];
//# sourceMappingURL=customTheme.d.ts.map
