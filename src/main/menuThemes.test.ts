import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';

import { buildThemeMenuItems } from '#/main/menu';
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

  it('adds a separator and plugin themes after built-in themes', () => {
    const items = buildThemeMenuItems(window, 'system', [
      { value: 'plugin:com.example:midnight', label: 'Midnight' }
    ]);

    const pluginIndex = items.findIndex((item) => item.label === 'Midnight');
    expect(items[pluginIndex - 1]).toEqual({ type: 'separator' });
    expect((items[pluginIndex] as MenuItemConstructorOptions).checked).toBe(false);
  });

  it('marks an active plugin theme as checked', () => {
    const pluginTheme = {
      value: 'plugin:com.example:midnight' as const,
      label: 'Midnight'
    };
    const items = buildThemeMenuItems(window, pluginTheme.value, [pluginTheme]);

    const midnightItem = items.find(
      (item) => item.label === 'Midnight'
    ) as MenuItemConstructorOptions;
    expect(midnightItem.checked).toBe(true);
  });
});
