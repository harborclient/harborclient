import type { CustomTheme, CustomThemeImportDraft } from '#/shared/types/customTheme';

/**
 * Input for saving a custom theme from the Designer form.
 */
export interface SaveCustomThemeInput {
  /**
   * Existing filename stem. Omitted when creating a new theme.
   */
  id?: string;

  /**
   * Human-readable theme title.
   */
  title: string;

  /**
   * Base appearance mode.
   */
  type: CustomTheme['type'];

  /**
   * Token overrides without the `--mac-` prefix.
   */
  colors: CustomTheme['colors'];

  /**
   * Optional extra CSS appended after token overrides when the theme is applied.
   */
  stylesheet?: string;
}

/**
 * IPC methods for user-authored custom themes.
 */
export interface ApiCustomThemes {
  /**
   * Lists all custom themes stored under `{userData}/custom_themes`.
   */
  listCustomThemes: () => Promise<CustomTheme[]>;

  /**
   * Returns one custom theme by id, or null when missing.
   *
   * @param id - Custom theme filename stem.
   */
  getCustomTheme: (id: string) => Promise<CustomTheme | null>;

  /**
   * Saves a custom theme export file and returns the stored record.
   *
   * @param input - Theme values to persist.
   */
  saveCustomTheme: (input: SaveCustomThemeInput) => Promise<CustomTheme>;

  /**
   * Deletes one custom theme file from disk.
   *
   * @param id - Custom theme filename stem.
   */
  deleteCustomTheme: (id: string) => Promise<void>;

  /**
   * Restores one built-in theme file from its packaged canonical export.
   *
   * @param id - Reserved built-in theme filename stem.
   */
  restoreBuiltinTheme: (id: string) => Promise<CustomTheme>;

  /**
   * Opens an import dialog and returns draft values without saving.
   */
  importCustomTheme: () => Promise<CustomThemeImportDraft | null>;
}
