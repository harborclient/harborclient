import { describe, expect, it } from 'vitest';
import { activeThemeKey, toActiveTheme } from './types';

describe('toActiveTheme', () => {
  it('maps built-in theme preferences', () => {
    expect(toActiveTheme('light')).toEqual({ source: 'builtin', id: 'light' });
    expect(toActiveTheme('dark')).toEqual({ source: 'builtin', id: 'dark' });
    expect(toActiveTheme('system')).toEqual({ source: 'builtin', id: 'system' });
    expect(toActiveTheme('high-contrast')).toEqual({ source: 'builtin', id: 'high-contrast' });
  });

  it('maps plugin theme preferences', () => {
    expect(toActiveTheme('plugin:com.example.demo:midnight')).toEqual({
      source: 'plugin',
      pluginId: 'com.example.demo',
      themeId: 'midnight'
    });
  });
});

describe('activeThemeKey', () => {
  it('serializes built-in and plugin themes distinctly', () => {
    expect(activeThemeKey({ source: 'builtin', id: 'dark' })).toBe('builtin:dark');
    expect(
      activeThemeKey({ source: 'plugin', pluginId: 'com.example.demo', themeId: 'midnight' })
    ).toBe('plugin:com.example.demo:midnight');
  });
});
