import { CUSTOM_THEME_TOKEN_GROUPS } from '@harborclient/core/types/customTheme';

/**
 * One Designer category tab pairing a stable slug with its core token group label.
 */
export interface ThemeDesignerCategoryTab {
  /**
   * Stable `SegmentedTabs` value that survives label wording changes.
   */
  value: string;

  /**
   * Token group label shared by the color and metric groups in core.
   */
  label: string;

  /**
   * Short blurb naming the app surfaces this category restyles, shown above the
   * field grid so users know what each tab affects before editing tokens.
   */
  description: string;
}

/**
 * Per-category descriptions keyed by token group label. Each entry names the
 * concrete parts of the interface the category's color and metric tokens style.
 */
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'Layout':
    'Main surfaces: app background, header (search + tabs), footer, controls, fields, separators, and the terminal — plus base font, border width, and radius.',
  'Rail & Sidebars':
    'Activity rail fills, text, and separators, plus the sidebar panel, toolbar strip, and section header colors.',
  'Breadcrumb':
    'Path breadcrumbs above the editor: background, segment chips, and breadcrumb typography.',
  'Text':
    'Primary, secondary, and muted text across the app, including footer copy — plus body, small, large, and monospace fonts.',
  'Interactive':
    'Accent for primary actions and focus, text selection, and documentation markdown links — plus interactive control typography, borders, radius, and focus ring.',
  'Chrome':
    'Active footer icons and toolbar actions, the active tab underline, pane resize handles, and variable tokens in editors.',
  'Tabs':
    'Request and editor tab chrome: unsaved indicator color plus tab typography, borders, and radius.',
  'Status':
    'Semantic colors for danger, warning, success, and info (errors, alerts, and pass/fail) — plus status badge typography.',
  'HTTP methods':
    'Method badges in the sidebar and request editor (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS).',
  'Scrollbar': 'Scrollbar track and thumb (including hover and active states) and scrollbar width.',
  'Script stages':
    'Collection and request script stage labels: before-all, before-each, main, after-each, and after-all.',
  'Git': 'Git status indicators for staged, uncommitted, unstaged, and untracked changes.'
};

/**
 * Derives a stable tab slug from a token group label.
 *
 * @param label - Token group label such as `HTTP methods`.
 * @returns Lowercased, hyphenated slug such as `http-methods`.
 */
export function themeDesignerCategorySlug(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Designer category tabs in color token group order. Metric groups reuse the same
 * labels, so each tab can present the colors and the typography/geometry fields
 * that belong to one part of the interface.
 */
export const THEME_DESIGNER_CATEGORY_TABS: ThemeDesignerCategoryTab[] =
  CUSTOM_THEME_TOKEN_GROUPS.map((group) => ({
    value: themeDesignerCategorySlug(group.label),
    label: group.label,
    description: CATEGORY_DESCRIPTIONS[group.label] ?? ''
  }));
