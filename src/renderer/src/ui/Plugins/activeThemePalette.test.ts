import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  inferActiveThemeType,
  readActiveThemePalette
} from '#/renderer/src/ui/Plugins/activeThemePalette';

describe('readActiveThemePalette', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads resolved --mac-* values from the document root', () => {
    const getPropertyValue = vi.fn((property: string) => {
      if (property === '--mac-surface') {
        return 'rgb(17, 34, 51)';
      }
      if (property === '--mac-accent') {
        return 'rgba(10, 132, 255, 0.5)';
      }
      return '';
    });

    vi.stubGlobal('document', { documentElement: {} });
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue }));

    const palette = readActiveThemePalette('light');

    expect(palette.surface).toBe('rgb(17, 34, 51)');
    expect(palette.accent).toBe('rgba(10, 132, 255, 0.5)');
  });
});

describe('inferActiveThemeType', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps built-in theme sources directly', async () => {
    await expect(inferActiveThemeType('light')).resolves.toBe('light');
    await expect(inferActiveThemeType('dark')).resolves.toBe('dark');
    await expect(inferActiveThemeType('high-contrast')).resolves.toBe('high-contrast');
  });

  it('infers dark for system when prefers-color-scheme is dark', async () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)'
      }))
    });

    await expect(inferActiveThemeType('system')).resolves.toBe('dark');
  });

  it('infers light for system when prefers-color-scheme is light', async () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: false }))
    });

    await expect(inferActiveThemeType('system')).resolves.toBe('light');
  });

  it('infers high-contrast for system when contrast preference is stronger', async () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn((query: string) => ({
        matches: query === '(prefers-contrast: more)'
      }))
    });

    await expect(inferActiveThemeType('system')).resolves.toBe('high-contrast');
  });
});
