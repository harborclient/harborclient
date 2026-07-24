import type { ThemeSource } from '#/shared/types';
import {
  HC_ACCENT,
  HC_MUTED,
  HC_SEPARATOR,
  HC_SURFACE,
  HC_TEXT
} from '#/shared/highContrastPalette';

/**
 * Colors used to render simplified theme preview cards in the picker modal.
 */
export interface ThemePreviewPalette {
  /** Main background color. */
  surface: string;
  /** Sidebar strip background color. */
  sidebar: string;
  /** Panel/control background color. */
  control: string;
  /** Primary text color. */
  text: string;
  /** Secondary/muted text color. */
  muted: string;
  /** Accent/action color. */
  accent: string;
  /** Border/separator color. */
  border: string;
}

/** Built-in appearance themes shown in the first-run picker. */
export type BuiltinThemeSource = Extract<
  ThemeSource,
  'light' | 'dark' | 'high-contrast' | 'system'
>;

/**
 * Preview palette for the light built-in theme (from `:root` in styles.css).
 */
export const LIGHT_PREVIEW_PALETTE: ThemePreviewPalette = {
  surface: '#f5f5f7',
  sidebar: '#ececee',
  control: '#ffffff',
  text: 'rgba(0, 0, 0, 0.85)',
  muted: 'rgba(0, 0, 0, 0.58)',
  accent: '#007aff',
  border: 'rgba(0, 0, 0, 0.08)'
};

/**
 * Preview palette for the dark built-in theme (from `prefers-color-scheme: dark`).
 */
export const DARK_PREVIEW_PALETTE: ThemePreviewPalette = {
  surface: '#1e1e1e',
  sidebar: '#252526',
  control: '#3a3a3c',
  text: 'rgba(255, 255, 255, 0.85)',
  muted: 'rgba(255, 255, 255, 0.58)',
  accent: '#0a84ff',
  border: 'rgba(255, 255, 255, 0.08)'
};

/**
 * Preview palette for the high-contrast built-in theme (from highContrastPalette.ts).
 */
export const HIGH_CONTRAST_PREVIEW_PALETTE: ThemePreviewPalette = {
  surface: HC_SURFACE,
  sidebar: HC_SURFACE,
  control: HC_SURFACE,
  text: HC_TEXT,
  muted: HC_MUTED,
  accent: HC_ACCENT,
  border: HC_SEPARATOR
};

/**
 * Maps each built-in theme to the palette used by its preview card.
 */
export const BUILTIN_THEME_PREVIEW_PALETTES: Record<BuiltinThemeSource, ThemePreviewPalette> = {
  'light': LIGHT_PREVIEW_PALETTE,
  'dark': DARK_PREVIEW_PALETTE,
  'high-contrast': HIGH_CONTRAST_PREVIEW_PALETTE,
  'system': LIGHT_PREVIEW_PALETTE
};

/**
 * Returns the preview palette for a built-in theme card.
 *
 * The system theme card uses a split light/dark mock; this helper returns the
 * light half palette for callers that need a single palette reference.
 *
 * @param theme - Built-in theme id.
 * @returns Preview colors for the card mock.
 */
export function getThemePreviewPalette(theme: BuiltinThemeSource): ThemePreviewPalette {
  return BUILTIN_THEME_PREVIEW_PALETTES[theme];
}
