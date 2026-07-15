import type { ThemeColorToken } from '@harborclient/sdk';
import {
  HC_ACCENT,
  HC_DANGER,
  HC_DANGER_LIGHT,
  HC_FIELD,
  HC_INFO,
  HC_METHOD_DELETE,
  HC_METHOD_GET,
  HC_METHOD_HEAD,
  HC_METHOD_OPTIONS,
  HC_METHOD_PATCH,
  HC_METHOD_POST,
  HC_METHOD_PUT,
  HC_MUTED,
  HC_SCROLLBAR_THUMB,
  HC_SCROLLBAR_THUMB_ACTIVE,
  HC_SCROLLBAR_THUMB_HOVER,
  HC_SCROLLBAR_TRACK,
  HC_SELECTION,
  HC_SEPARATOR,
  HC_SUCCESS,
  HC_SURFACE,
  HC_TEXT,
  HC_TEXT_SECONDARY,
  HC_WARNING
} from '#/shared/highContrastPalette';
import type { CustomThemeType } from '#/shared/types/customTheme';

/**
 * Full default palette for one custom theme base appearance.
 */
export type CustomThemePalette = Record<ThemeColorToken, string>;

/**
 * Default light palette mirrored from `:root` in styles.css.
 */
export const LIGHT_CUSTOM_THEME_PALETTE: CustomThemePalette = {
  'surface': '#f5f5f7',
  'sidebar': '#ececee',
  'sidebar-section': 'rgba(0, 122, 255, 0.18)',
  'breadcrumb-background': '#ececee',
  'breadcrumb-segment': '#ececee',
  'control': '#ffffff',
  'field': '#ffffff',
  'separator': 'rgba(0, 0, 0, 0.08)',
  'text': 'rgba(0, 0, 0, 0.85)',
  'text-secondary': 'rgba(0, 0, 0, 0.65)',
  'muted': 'rgba(0, 0, 0, 0.58)',
  'accent': '#007aff',
  'selection': 'rgba(0, 122, 255, 0.18)',
  'doc-markdown': '#007aff',
  'tab-unsaved': '#b45309',
  'danger': '#ff3b30',
  'danger-light': '#d70015',
  'warning': '#ff9500',
  'success': '#34c759',
  'info': 'rgba(0, 0, 0, 0.55)',
  'method-get': '#2d8a4e',
  'method-post': '#0066cc',
  'method-put': '#b8860b',
  'method-patch': '#7b5ea7',
  'method-delete': '#c0392b',
  'method-head': '#6e6e73',
  'method-options': '#6e6e73',
  'scrollbar-track': 'rgba(0, 0, 0, 0.06)',
  'scrollbar-thumb': 'rgba(0, 0, 0, 0.44)',
  'scrollbar-thumb-hover': 'rgba(0, 0, 0, 0.55)',
  'scrollbar-thumb-active': 'rgba(0, 0, 0, 0.66)',
  'script-stage-before-all': '#1360ae',
  'script-stage-before-each': '#0a84ff',
  'script-stage-main': '#32d2e2',
  'script-stage-after-each': '#ff9f0a',
  'script-stage-after-all': '#ae7213',
  'terminal': '#000000',
  'git-staged': '#34c759',
  'git-uncommitted': '#ff9500',
  'git-unstaged': 'rgba(0, 0, 0, 0.58)',
  'git-untracked': '#34c759'
};

/**
 * Default dark palette mirrored from `:root[data-theme='dark']` in styles.css.
 */
export const DARK_CUSTOM_THEME_PALETTE: CustomThemePalette = {
  'surface': '#1e1e1e',
  'sidebar': '#252526',
  'sidebar-section': '#343437',
  'breadcrumb-background': '#252526',
  'breadcrumb-segment': '#252526',
  'control': '#3a3a3c',
  'field': '#191919',
  'separator': 'rgba(255, 255, 255, 0.08)',
  'text': 'rgba(255, 255, 255, 0.85)',
  'text-secondary': 'rgba(255, 255, 255, 0.65)',
  'muted': 'rgba(255, 255, 255, 0.58)',
  'accent': '#0a84ff',
  'selection': 'rgba(10, 132, 255, 0.22)',
  'doc-markdown': '#0a84ff',
  'tab-unsaved': '#ffb340',
  'danger': '#ff453a',
  'danger-light': '#ff6961',
  'warning': '#ff9f0a',
  'success': '#30d158',
  'info': 'rgba(255, 255, 255, 0.55)',
  'method-get': '#2d8a4e',
  'method-post': '#2f8eed',
  'method-put': '#b8860b',
  'method-patch': '#7b5ea7',
  'method-delete': '#de5445',
  'method-head': '#6e6e73',
  'method-options': '#6e6e73',
  'scrollbar-track': 'rgba(255, 255, 255, 0.06)',
  'scrollbar-thumb': 'rgba(255, 255, 255, 0.44)',
  'scrollbar-thumb-hover': 'rgba(255, 255, 255, 0.55)',
  'scrollbar-thumb-active': 'rgba(255, 255, 255, 0.66)',
  'script-stage-before-all': '#1360ae',
  'script-stage-before-each': '#0a84ff',
  'script-stage-main': '#32d2e2',
  'script-stage-after-each': '#ff9f0a',
  'script-stage-after-all': '#ae7213',
  'terminal': '#000000',
  'git-staged': '#30d158',
  'git-uncommitted': '#ff9f0a',
  'git-unstaged': 'rgba(255, 255, 255, 0.58)',
  'git-untracked': '#30d158'
};

/**
 * Default high-contrast palette mirrored from highContrastPalette.ts and styles.css.
 */
export const HIGH_CONTRAST_CUSTOM_THEME_PALETTE: CustomThemePalette = {
  'surface': HC_SURFACE,
  'sidebar': HC_SURFACE,
  'sidebar-section': HC_SEPARATOR,
  'breadcrumb-background': HC_SURFACE,
  'breadcrumb-segment': HC_SURFACE,
  'control': HC_SURFACE,
  'field': HC_FIELD,
  'separator': HC_SEPARATOR,
  'text': HC_TEXT,
  'text-secondary': HC_TEXT_SECONDARY,
  'muted': HC_MUTED,
  'accent': HC_ACCENT,
  'selection': HC_SELECTION,
  'doc-markdown': HC_ACCENT,
  'tab-unsaved': '#ffd60a',
  'danger': HC_DANGER,
  'danger-light': HC_DANGER_LIGHT,
  'warning': HC_WARNING,
  'success': HC_SUCCESS,
  'info': HC_INFO,
  'method-get': HC_METHOD_GET,
  'method-post': HC_METHOD_POST,
  'method-put': HC_METHOD_PUT,
  'method-patch': HC_METHOD_PATCH,
  'method-delete': HC_METHOD_DELETE,
  'method-head': HC_METHOD_HEAD,
  'method-options': HC_METHOD_OPTIONS,
  'scrollbar-track': HC_SCROLLBAR_TRACK,
  'scrollbar-thumb': HC_SCROLLBAR_THUMB,
  'scrollbar-thumb-hover': HC_SCROLLBAR_THUMB_HOVER,
  'scrollbar-thumb-active': HC_SCROLLBAR_THUMB_ACTIVE,
  'script-stage-before-all': '#1360ae',
  'script-stage-before-each': '#0a84ff',
  'script-stage-main': '#32d2e2',
  'script-stage-after-each': '#ff9f0a',
  'script-stage-after-all': '#ae7213',
  'terminal': '#000000',
  'git-staged': '#5ce06a',
  'git-uncommitted': '#ffb340',
  'git-unstaged': '#d0d0d0',
  'git-untracked': '#5ce06a'
};

/**
 * Maps each custom theme base appearance to its default palette.
 */
export const CUSTOM_THEME_DEFAULT_PALETTES: Record<CustomThemeType, CustomThemePalette> = {
  'light': LIGHT_CUSTOM_THEME_PALETTE,
  'dark': DARK_CUSTOM_THEME_PALETTE,
  'high-contrast': HIGH_CONTRAST_CUSTOM_THEME_PALETTE
};

/**
 * Returns the default palette for a custom theme base appearance.
 *
 * @param type - Base appearance mode selected in the Designer form.
 * @returns Full token palette used to seed new or reseeded themes.
 */
export function getDefaultCustomThemePalette(type: CustomThemeType): CustomThemePalette {
  return { ...CUSTOM_THEME_DEFAULT_PALETTES[type] };
}

/**
 * Default title for a newly created custom theme.
 */
export const DEFAULT_CUSTOM_THEME_TITLE = 'Default';
