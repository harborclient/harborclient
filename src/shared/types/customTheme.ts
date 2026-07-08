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
}

/**
 * One labeled group of theme color tokens for the Creator grid.
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
 * Human-readable labels for each theme color token in the Creator grid.
 */
export const CUSTOM_THEME_TOKEN_LABELS: Record<ThemeColorToken, string> = {
  surface: 'Surface',
  sidebar: 'Sidebar',
  'sidebar-section': 'Sidebar section',
  control: 'Control',
  field: 'Field',
  separator: 'Separator',
  text: 'Text',
  'text-secondary': 'Text secondary',
  muted: 'Muted',
  accent: 'Accent',
  selection: 'Selection',
  danger: 'Danger',
  'danger-light': 'Danger light',
  warning: 'Warning',
  success: 'Success',
  info: 'Info',
  'method-get': 'GET',
  'method-post': 'POST',
  'method-put': 'PUT',
  'method-patch': 'PATCH',
  'method-delete': 'DELETE',
  'method-head': 'HEAD',
  'method-options': 'OPTIONS',
  'scrollbar-track': 'Scrollbar track',
  'scrollbar-thumb': 'Scrollbar thumb',
  'scrollbar-thumb-hover': 'Scrollbar thumb hover',
  'scrollbar-thumb-active': 'Scrollbar thumb active'
};

/**
 * Ordered token groups for the Creator color grid.
 */
export const CUSTOM_THEME_TOKEN_GROUPS: CustomThemeTokenGroup[] = [
  {
    label: 'Layout',
    tokens: ['surface', 'sidebar', 'sidebar-section', 'control', 'field', 'separator']
  },
  {
    label: 'Text',
    tokens: ['text', 'text-secondary', 'muted']
  },
  {
    label: 'Interactive',
    tokens: ['accent', 'selection']
  },
  {
    label: 'Status',
    tokens: ['danger', 'danger-light', 'warning', 'success', 'info']
  },
  {
    label: 'HTTP methods',
    tokens: [
      'method-get',
      'method-post',
      'method-put',
      'method-patch',
      'method-delete',
      'method-head',
      'method-options'
    ]
  },
  {
    label: 'Scrollbar',
    tokens: [
      'scrollbar-track',
      'scrollbar-thumb',
      'scrollbar-thumb-hover',
      'scrollbar-thumb-active'
    ]
  }
];

/**
 * All theme color tokens in display order for the Creator grid.
 */
export const CUSTOM_THEME_TOKENS: ThemeColorToken[] = CUSTOM_THEME_TOKEN_GROUPS.flatMap(
  (group) => group.tokens
);

/**
 * Key palette tokens used for the 4x4 swatch preview on Installed cards.
 */
export const CUSTOM_THEME_SWATCH_TOKENS: ThemeColorToken[] = [
  'surface',
  'sidebar',
  'control',
  'field',
  'accent',
  'selection',
  'text',
  'text-secondary',
  'muted',
  'success',
  'warning',
  'danger',
  'danger-light',
  'info',
  'method-get',
  'method-post'
];
