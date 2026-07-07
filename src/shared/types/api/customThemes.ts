import type { CustomTheme, CustomThemeImportDraft } from '#/shared/types/customTheme';

/**
 * Input for saving a custom theme from the Creator form.
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
   * Opens an import dialog and returns draft values without saving.
   */
  importCustomTheme: () => Promise<CustomThemeImportDraft | null>;
}
