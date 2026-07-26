import type { ThemeColorToken, ThemeMetricToken } from '@harborclient/sdk';

/**
 * Base appearance mode for a user-authored custom theme.
 */
export type CustomThemeType = 'light' | 'dark' | 'high-contrast';

/**
 * Designer control kind for a metric token field.
 */
export type CustomThemeMetricControlKind = 'font-family' | 'font-size' | 'length';

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
   * Color token overrides without the `--mac-` prefix.
   */
  colors: Partial<Record<ThemeColorToken, string>>;

  /**
   * Typography and geometry token overrides without the `--mac-` prefix.
   */
  metrics?: Partial<Record<ThemeMetricToken, string>>;

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
   * Color token overrides without the `--mac-` prefix.
   */
  theme: Partial<Record<ThemeColorToken, string>>;

  /**
   * Typography and geometry token overrides without the `--mac-` prefix.
   */
  metrics?: Partial<Record<ThemeMetricToken, string>>;

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
   * Imported color token overrides.
   */
  colors: Partial<Record<ThemeColorToken, string>>;

  /**
   * Imported typography and geometry token overrides.
   */
  metrics?: Partial<Record<ThemeMetricToken, string>>;

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
 * One labeled group of theme metric tokens for the Designer grid.
 */
export interface CustomThemeMetricGroup {
  /**
   * Section heading shown above a metric token group.
   */
  label: string;

  /**
   * Ordered metric token keys in this group.
   */
  tokens: ThemeMetricToken[];
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
  'breadcrumb-current': 'Breadcrumb current',
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
 * Human-readable labels for each theme metric token in the Designer grid.
 */
export const CUSTOM_THEME_METRIC_LABELS: Record<ThemeMetricToken, string> = {
  'layout-font-family': 'Font family',
  'layout-font-size': 'Font size',
  'layout-border-width': 'Border width',
  'layout-radius': 'Radius',
  'breadcrumb-font-family': 'Font family',
  'breadcrumb-font-size': 'Font size',
  'breadcrumb-border-width': 'Border width',
  'breadcrumb-radius': 'Radius',
  'text-font-family': 'Font family',
  'text-font-family-mono': 'Mono font family',
  'text-font-size': 'Font size',
  'text-font-size-sm': 'Font size (sm)',
  'text-font-size-lg': 'Font size (lg)',
  'interactive-font-family': 'Font family',
  'interactive-font-size': 'Font size',
  'interactive-border-width': 'Border width',
  'interactive-radius': 'Radius',
  'interactive-focus-ring-width': 'Focus ring width',
  'chrome-font-family': 'Font family',
  'chrome-font-size': 'Font size',
  'chrome-border-width': 'Border width',
  'chrome-radius': 'Radius',
  'tab-font-family': 'Font family',
  'tab-font-size': 'Font size',
  'tab-border-width': 'Border width',
  'tab-radius': 'Radius',
  'status-font-family': 'Font family',
  'status-font-size': 'Font size',
  'status-border-width': 'Border width',
  'status-radius': 'Radius',
  'method-font-family': 'Font family',
  'method-font-size': 'Font size',
  'method-border-width': 'Border width',
  'method-radius': 'Radius',
  'script-stage-font-family': 'Font family',
  'script-stage-font-size': 'Font size',
  'script-stage-border-width': 'Border width',
  'script-stage-radius': 'Radius',
  'git-font-family': 'Font family',
  'git-font-size': 'Font size',
  'git-border-width': 'Border width',
  'git-radius': 'Radius',
  'scrollbar-width': 'Width'
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
    tokens: ['breadcrumb-background', 'breadcrumb-segment', 'breadcrumb-current']
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
 * Ordered metric token groups for the Designer metrics grid.
 */
export const CUSTOM_THEME_METRIC_GROUPS: CustomThemeMetricGroup[] = [
  {
    label: 'Layout',
    tokens: ['layout-font-family', 'layout-font-size', 'layout-border-width', 'layout-radius']
  },
  {
    label: 'Breadcrumb',
    tokens: [
      'breadcrumb-font-family',
      'breadcrumb-font-size',
      'breadcrumb-border-width',
      'breadcrumb-radius'
    ]
  },
  {
    label: 'Text',
    tokens: [
      'text-font-family',
      'text-font-family-mono',
      'text-font-size',
      'text-font-size-sm',
      'text-font-size-lg'
    ]
  },
  {
    label: 'Interactive',
    tokens: [
      'interactive-font-family',
      'interactive-font-size',
      'interactive-border-width',
      'interactive-radius',
      'interactive-focus-ring-width'
    ]
  },
  {
    label: 'Chrome',
    tokens: ['chrome-font-family', 'chrome-font-size', 'chrome-border-width', 'chrome-radius']
  },
  {
    label: 'Tabs',
    tokens: ['tab-font-family', 'tab-font-size', 'tab-border-width', 'tab-radius']
  },
  {
    label: 'Status',
    tokens: ['status-font-family', 'status-font-size', 'status-border-width', 'status-radius']
  },
  {
    label: 'HTTP methods',
    tokens: ['method-font-family', 'method-font-size', 'method-border-width', 'method-radius']
  },
  {
    label: 'Script stages',
    tokens: [
      'script-stage-font-family',
      'script-stage-font-size',
      'script-stage-border-width',
      'script-stage-radius'
    ]
  },
  {
    label: 'Git',
    tokens: ['git-font-family', 'git-font-size', 'git-border-width', 'git-radius']
  },
  {
    label: 'Scrollbar',
    tokens: ['scrollbar-width']
  }
];

/**
 * All theme color tokens in display order for the Designer grid.
 */
export const CUSTOM_THEME_TOKENS: ThemeColorToken[] = CUSTOM_THEME_TOKEN_GROUPS.flatMap(
  (group) => group.tokens
);

/**
 * All theme metric tokens in display order for the Designer grid.
 */
export const CUSTOM_THEME_METRICS: ThemeMetricToken[] = CUSTOM_THEME_METRIC_GROUPS.flatMap(
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

/**
 * Returns the Designer control kind for a metric token.
 *
 * @param token - Metric token id without the `--mac-` prefix.
 * @returns Control kind used to render the metric field.
 */
export function customThemeMetricControlKind(
  token: ThemeMetricToken
): CustomThemeMetricControlKind {
  if (token.includes('font-family')) {
    return 'font-family';
  }
  if (token.includes('font-size')) {
    return 'font-size';
  }
  return 'length';
}
