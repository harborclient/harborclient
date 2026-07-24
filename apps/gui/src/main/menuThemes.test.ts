import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';

import { buildThemeMenuItems } from './menu';
import { BUILTIN_THEME_OPTIONS } from '#/shared/themes';

describe('buildThemeMenuItems', () => {
  const window = {
    webContents: { send: vi.fn() }
  } as unknown as BrowserWindow;

  it('adds a separator before built-in themes with a checkmark on the active theme', () => {
    const items = buildThemeMenuItems(window, 'dark', []);

    expect(items[0]).toEqual({ type: 'separator' });
    expect(items).toHaveLength(BUILTIN_THEME_OPTIONS.length + 1);

    const darkItem = items.find((item) => item.label === 'Dark') as MenuItemConstructorOptions;
    const lightItem = items.find((item) => item.label === 'Light') as MenuItemConstructorOptions;

    expect(darkItem.type).toBe('checkbox');
    expect(darkItem.checked).toBe(true);
    expect(lightItem.checked).toBe(false);
  });

  it('does not add plugin themes to the View menu', () => {
    const items = buildThemeMenuItems(window, 'system', [
      { value: 'plugin:com.example:midnight', label: 'Midnight' }
    ]);

    expect(items).toHaveLength(BUILTIN_THEME_OPTIONS.length + 1);
    expect(items.some((item) => item.label === 'Midnight')).toBe(false);
  });

  it('rebuilds the menu after a theme click so active checkmarks stay checked', () => {
    const onThemeMenuClick = vi.fn();
    const items = buildThemeMenuItems(window, 'dark', [], onThemeMenuClick);
    const darkItem = items.find((item) => item.label === 'Dark') as MenuItemConstructorOptions;

    (darkItem.click as () => void)();

    expect(window.webContents.send).toHaveBeenCalledWith('menu:selectTheme', {
      theme: 'dark',
      label: 'Dark'
    });
    expect(onThemeMenuClick).toHaveBeenCalledOnce();
  });
});
