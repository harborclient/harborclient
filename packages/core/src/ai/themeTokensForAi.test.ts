import { describe, expect, it } from 'vitest';
import type { CustomTheme } from '../types/customTheme.js';
import { buildThemeTokenPatch, resolveActiveThemeFileForUpdate } from './themeTokensForAi.js';

/**
 * Builds a minimal custom theme for patch tests.
 *
 * @param overrides - Partial theme fields.
 */
function sampleTheme(overrides: Partial<CustomTheme> = {}): CustomTheme {
  return {
    id: 'dark',
    title: 'Dark',
    type: 'dark',
    colors: { accent: '#007acc', surface: '#1e1e1e' },
    metrics: { 'layout-radius': '0.375rem' },
    builtin: true,
    ...overrides
  };
}

describe('resolveActiveThemeFileForUpdate', () => {
  it('maps custom themes to their filename stem', () => {
    expect(resolveActiveThemeFileForUpdate('custom:my-theme', () => 'dark')).toEqual({
      activeTheme: 'custom:my-theme',
      themeId: 'my-theme'
    });
  });

  it('maps built-in and system preferences to seeded theme files', () => {
    expect(resolveActiveThemeFileForUpdate('dark', () => 'light')).toEqual({
      activeTheme: 'dark',
      themeId: 'dark',
      builtinId: 'dark'
    });
    expect(resolveActiveThemeFileForUpdate('system', () => 'high-contrast')).toEqual({
      activeTheme: 'system',
      themeId: 'high-contrast',
      builtinId: 'high-contrast'
    });
  });

  it('rejects plugin themes', () => {
    const result = resolveActiveThemeFileForUpdate('plugin:com.example:solarized', () => 'dark');
    expect(result).toEqual({
      error: expect.stringContaining('plugin theme')
    });
  });
});

describe('buildThemeTokenPatch', () => {
  it('patches a color token', () => {
    const result = buildThemeTokenPatch(sampleTheme(), '--mac-accent', '#ff0000');
    expect(result).toMatchObject({
      previousValue: '#007acc',
      value: '#ff0000',
      colors: expect.objectContaining({ accent: '#ff0000', surface: '#1e1e1e' })
    });
    if (!('error' in result)) {
      expect(result.entry.token).toBe('accent');
    }
  });

  it('patches a metric token', () => {
    const result = buildThemeTokenPatch(sampleTheme(), 'layout-radius', '0.5rem');
    expect(result).toMatchObject({
      previousValue: '0.375rem',
      value: '0.5rem',
      metrics: expect.objectContaining({ 'layout-radius': '0.5rem' })
    });
  });

  it('rejects empty values and unknown tokens', () => {
    expect(buildThemeTokenPatch(sampleTheme(), 'accent', '   ')).toEqual({
      error: 'Provide a non-empty CSS value for the theme token.'
    });
    expect(buildThemeTokenPatch(sampleTheme(), 'not-real', '#fff')).toEqual({
      error: 'Unknown theme token: not-real'
    });
  });
});
