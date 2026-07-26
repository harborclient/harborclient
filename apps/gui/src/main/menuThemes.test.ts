import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';

import { buildThemeMenuItems } from './menu';
import { BUILTIN_THEME_OPTIONS } from '@harborclient/core/themes';

describe('buildThemeMenuItems', () => {
  const window = {
    webContents: { send: vi.fn() }
  } as unknown as BrowserWindow;

  it('nests built-in themes under a Theme submenu with a checkmark on the active theme', () => {
    const item = buildThemeMenuItems(window, 'dark', []);

    expect(item.label).toBe('Theme');
    const submenu = item.submenu as MenuItemConstructorOptions[];
    expect(submenu).toHaveLength(BUILTIN_THEME_OPTIONS.length);

    const darkItem = submenu.find((entry) => entry.label === 'Dark') as MenuItemConstructorOptions;
    const lightItem = submenu.find(
      (entry) => entry.label === 'Light'
    ) as MenuItemConstructorOptions;

    expect(darkItem.type).toBe('checkbox');
    expect(darkItem.checked).toBe(true);
    expect(lightItem.checked).toBe(false);
  });

  it('lists installed themes after a separator below the built-in themes', () => {
    const item = buildThemeMenuItems(window, 'system', [
      { value: 'plugin:com.example:midnight', label: 'Midnight' }
    ]);

    const submenu = item.submenu as MenuItemConstructorOptions[];
    expect(submenu).toHaveLength(BUILTIN_THEME_OPTIONS.length + 2);
    expect(submenu[BUILTIN_THEME_OPTIONS.length]).toEqual({ type: 'separator' });

    const midnightItem = submenu.find(
      (entry) => entry.label === 'Midnight'
    ) as MenuItemConstructorOptions;
    expect(midnightItem.type).toBe('checkbox');
    expect(midnightItem.checked).toBe(false);
  });

  it('omits the installed-theme separator when there are no installed themes', () => {
    const item = buildThemeMenuItems(window, 'system', []);
    const submenu = item.submenu as MenuItemConstructorOptions[];

    expect(submenu.some((entry) => entry.type === 'separator')).toBe(false);
  });

  it('rebuilds the menu after a theme click so active checkmarks stay checked', () => {
    const onThemeMenuClick = vi.fn();
    const item = buildThemeMenuItems(window, 'dark', [], onThemeMenuClick);
    const submenu = item.submenu as MenuItemConstructorOptions[];
    const darkItem = submenu.find((entry) => entry.label === 'Dark') as MenuItemConstructorOptions;

    (darkItem.click as () => void)();

    expect(window.webContents.send).toHaveBeenCalledWith('menu:selectTheme', {
      theme: 'dark',
      label: 'Dark'
    });
    expect(onThemeMenuClick).toHaveBeenCalledOnce();
  });
});
