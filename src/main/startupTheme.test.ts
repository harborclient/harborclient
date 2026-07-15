import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseStartupThemeFlag } from './startupTheme';

describe('parseStartupThemeFlag', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns dark for --theme dark', () => {
    expect(parseStartupThemeFlag(['electron', '--theme', 'dark'])).toBe('dark');
  });

  it('returns dark for --theme=dark', () => {
    expect(parseStartupThemeFlag(['electron', '--theme=dark'])).toBe('dark');
  });

  it('normalizes high contrast aliases', () => {
    expect(parseStartupThemeFlag(['electron', '--theme', 'high contrast'])).toBe('high-contrast');
    expect(parseStartupThemeFlag(['electron', '--theme=high_contrast'])).toBe('high-contrast');
  });

  it('returns null when --theme is absent', () => {
    expect(parseStartupThemeFlag(['electron', '--verbose'])).toBeNull();
  });

  it('returns null and warns for unsupported values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(parseStartupThemeFlag(['electron', '--theme', 'plugin:foo:bar'])).toBeNull();
    expect(warn).toHaveBeenCalledWith('Ignoring unsupported --theme value: plugin:foo:bar');
  });
});
