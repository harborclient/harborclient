import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import {
  HC_ACCENT,
  HC_FOOTER_ICON_ACTIVE,
  HC_METHOD_COLORS,
  HC_PRIMARY_BUTTON_TEXT,
  HC_RESIZE_HANDLE,
  HC_SELECTION,
  HC_SEPARATOR,
  HC_SIDEBAR_SECTION_TEXT,
  HC_SURFACE,
  HC_TEXT,
  HC_TEXT_ON_SURFACE,
  HC_TOOLBAR_ACTION_ACTIVE
} from './highContrastPalette';

describe('contrastRatio', () => {
  it('returns 21:1 for pure white on pure black', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
  });
});

describe('highContrastPalette', () => {
  it('keeps normal text tokens at or above WCAG AAA (7:1) on the surface', () => {
    for (const token of HC_TEXT_ON_SURFACE) {
      expect(contrastRatio(token, HC_SURFACE)).toBeGreaterThanOrEqual(7);
    }
  });

  it('keeps UI separators at or above WCAG UI contrast (3:1) on the surface', () => {
    expect(HC_SEPARATOR).toBe(HC_RESIZE_HANDLE);
    expect(contrastRatio(HC_SEPARATOR, HC_SURFACE)).toBeGreaterThanOrEqual(3);
  });

  it('keeps white text readable on selection and accent-button backgrounds', () => {
    expect(contrastRatio(HC_TEXT, HC_SELECTION)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(HC_PRIMARY_BUTTON_TEXT, HC_RESIZE_HANDLE)).toBeGreaterThanOrEqual(7);
  });

  it('keeps black text readable on yellow section-header backgrounds', () => {
    expect(contrastRatio(HC_PRIMARY_BUTTON_TEXT, HC_SEPARATOR)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(HC_SIDEBAR_SECTION_TEXT, HC_SEPARATOR)).toBeGreaterThanOrEqual(7);
  });

  it('keeps footer icon and toolbar action active colors at or above AAA on the surface', () => {
    expect(contrastRatio(HC_FOOTER_ICON_ACTIVE, HC_SURFACE)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(HC_TOOLBAR_ACTION_ACTIVE, HC_SURFACE)).toBeGreaterThanOrEqual(7);
  });

  it('keeps focus/accent colors at or above AAA on the surface', () => {
    expect(contrastRatio(HC_ACCENT, HC_SURFACE)).toBeGreaterThanOrEqual(7);
  });

  it('keeps each HTTP method label color at or above AAA (7:1) on the surface', () => {
    for (const token of HC_METHOD_COLORS) {
      expect(contrastRatio(token, HC_SURFACE)).toBeGreaterThanOrEqual(7);
    }
  });
});
