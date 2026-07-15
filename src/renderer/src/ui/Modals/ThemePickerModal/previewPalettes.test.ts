import { describe, expect, it } from 'vitest';
import {
  BUILTIN_THEME_PREVIEW_PALETTES,
  DARK_PREVIEW_PALETTE,
  HIGH_CONTRAST_PREVIEW_PALETTE,
  LIGHT_PREVIEW_PALETTE,
  getThemePreviewPalette
} from '#/renderer/src/ui/Modals/ThemePickerModal/previewPalettes';
import { HC_ACCENT, HC_SURFACE } from '#/shared/highContrastPalette';

describe('getThemePreviewPalette', () => {
  it('returns light palette for light theme', () => {
    expect(getThemePreviewPalette('light')).toEqual(LIGHT_PREVIEW_PALETTE);
  });

  it('returns dark palette for dark theme', () => {
    expect(getThemePreviewPalette('dark')).toEqual(DARK_PREVIEW_PALETTE);
  });

  it('returns high-contrast palette for high-contrast theme', () => {
    expect(getThemePreviewPalette('high-contrast')).toEqual(HIGH_CONTRAST_PREVIEW_PALETTE);
    expect(getThemePreviewPalette('high-contrast').surface).toBe(HC_SURFACE);
    expect(getThemePreviewPalette('high-contrast').accent).toBe(HC_ACCENT);
  });

  it('defines palettes for all built-in themes', () => {
    expect(Object.keys(BUILTIN_THEME_PREVIEW_PALETTES).sort()).toEqual([
      'dark',
      'high-contrast',
      'light',
      'system'
    ]);
  });
});
