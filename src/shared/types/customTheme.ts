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
export const CUSTOM_THEME_TOKEN_LABELS: Record<ThemeColorToken, string> = {
  'surface': 'Surface',
  'sidebar': 'Sidebar',
  'sidebar-toolbar': 'Sidebar toolbar',
  'sidebar-section': 'Sidebar section',
  'sidebar-section-text': 'Sidebar section text',
  'footer': 'Footer',
  'footer-text': 'Footer text',
  'footer-muted': 'Footer muted',
  'footer-icon-active': 'Footer icon active',
  'toolbar-action-active': 'Toolbar action active',
  'breadcrumb-background': 'Breadcrumb background',
  'breadcrumb-segment': 'Breadcrumb segment',
  'control': 'Control',
  'field': 'Field',
  'separator': 'Separator',
  'text': 'Text',
  'text-secondary': 'Text secondary',
  'muted': 'Muted',
  'accent': 'Accent',
  'selection': 'Selection',
  'doc-markdown': 'Markdown document',
  'tab-unsaved': 'Unsaved tab text',
  'tab-underline': 'Tab underline',
  'resize-handle': 'Resize handle',
  'variable-token': 'Variable token',
  'danger': 'Danger',
  'danger-light': 'Danger light',
  'warning': 'Warning',
  'success': 'Success',
  'info': 'Info',
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
  'scrollbar-thumb-active': 'Scrollbar thumb active',
  'script-stage-before-all': 'Before all',
  'script-stage-before-each': 'Before each',
  'script-stage-main': 'Main',
  'script-stage-after-each': 'After each',
  'script-stage-after-all': 'After all',
  'terminal': 'Terminal',
  'git-staged': 'Git staged',
  'git-uncommitted': 'Git uncommitted',
  'git-unstaged': 'Git unstaged',
  'git-untracked': 'Git untracked'
};

/**
 * Ordered token groups for the Designer color grid.
 */
export const CUSTOM_THEME_TOKEN_GROUPS: CustomThemeTokenGroup[] = [
  {
    label: 'Layout',
    tokens: [
      'surface',
      'sidebar',
      'sidebar-toolbar',
      'sidebar-section',
      'footer',
      'control',
      'field',
      'separator',
      'terminal'
    ]
  },
  {
    label: 'Breadcrumb',
    tokens: ['breadcrumb-background', 'breadcrumb-segment']
  },
  {
    label: 'Text',
    tokens: [
      'text',
      'text-secondary',
      'muted',
      'sidebar-section-text',
      'footer-text',
      'footer-muted'
    ]
  },
  {
    label: 'Interactive',
    tokens: ['accent', 'selection', 'doc-markdown']
  },
  {
    label: 'Chrome',
    tokens: [
      'footer-icon-active',
      'toolbar-action-active',
      'tab-underline',
      'resize-handle',
      'variable-token'
    ]
  },
  {
    label: 'Tabs',
    tokens: ['tab-unsaved']
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
  },
  {
    label: 'Script stages',
    tokens: [
      'script-stage-before-all',
      'script-stage-before-each',
      'script-stage-main',
      'script-stage-after-each',
      'script-stage-after-all'
    ]
  },
  {
    label: 'Git',
    tokens: ['git-staged', 'git-uncommitted', 'git-unstaged', 'git-untracked']
  }
];

/**
 * All theme color tokens in display order for the Designer grid.
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
