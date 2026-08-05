import { describe, expect, it } from 'vitest';
import { CUSTOM_THEME_METRICS, CUSTOM_THEME_TOKENS } from '../types/customTheme.js';
import {
  getThemeTokenCatalogEntry,
  isThemeColorToken,
  isThemeMetricToken,
  listThemeTokenCatalog,
  normalizeThemeTokenInput,
  THEME_TOKEN_CATALOG
} from './themeTokenCatalog.js';

describe('themeTokenCatalog', () => {
  it('includes every Designer color and metric token', () => {
    const expectedCount = CUSTOM_THEME_TOKENS.length + CUSTOM_THEME_METRICS.length;
    expect(THEME_TOKEN_CATALOG).toHaveLength(expectedCount);
    expect(listThemeTokenCatalog()).toHaveLength(expectedCount);

    for (const token of CUSTOM_THEME_TOKENS) {
      const entry = getThemeTokenCatalogEntry(token);
      expect(entry, `missing color token ${token}`).toBeDefined();
      expect(entry?.kind).toBe('color');
      expect(entry?.name).toBe(`--mac-${token}`);
      expect(entry?.defaults.light.length).toBeGreaterThan(0);
      expect(entry?.defaults.dark.length).toBeGreaterThan(0);
      expect(entry?.defaults.highContrast.length).toBeGreaterThan(0);
    }

    for (const token of CUSTOM_THEME_METRICS) {
      const entry = getThemeTokenCatalogEntry(token);
      expect(entry, `missing metric token ${token}`).toBeDefined();
      expect(entry?.kind).toBe('metric');
      expect(entry?.name).toBe(`--mac-${token}`);
    }
  });

  it('normalizes bare ids and --mac-* CSS variable names', () => {
    expect(normalizeThemeTokenInput('surface')).toBe('surface');
    expect(normalizeThemeTokenInput('--mac-surface')).toBe('surface');
    expect(normalizeThemeTokenInput('--MAC-ACCENT')).toBe('accent');
    expect(normalizeThemeTokenInput('  layout-font-size  ')).toBe('layout-font-size');
  });

  it('rejects unknown or empty token input', () => {
    expect(() => normalizeThemeTokenInput('')).toThrow('Theme token is required.');
    expect(() => normalizeThemeTokenInput('--mac-not-a-real-token')).toThrow('Unknown theme token');
  });

  it('classifies color vs metric tokens', () => {
    expect(isThemeColorToken('accent')).toBe(true);
    expect(isThemeMetricToken('accent')).toBe(false);
    expect(isThemeMetricToken('layout-radius')).toBe(true);
    expect(isThemeColorToken('layout-radius')).toBe(false);
  });

  it('exposes catalog fields expected by AI tools', () => {
    const accent = getThemeTokenCatalogEntry('accent');
    expect(accent).toMatchObject({
      name: '--mac-accent',
      token: 'accent',
      kind: 'color',
      group: 'Interactive',
      label: 'Accent'
    });
    expect(accent?.description.length).toBeGreaterThan(0);
    expect(accent?.defaults.light).toBe('#007acc');
  });
});
