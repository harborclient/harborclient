import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';

import { buildAppearanceMenuItems } from './menu';
import { resolveAcceleratorMap } from '@harborclient/core/shortcuts';

describe('buildAppearanceMenuItems', () => {
  const window = {
    webContents: { send: vi.fn() }
  } as unknown as BrowserWindow;
  const accelerators = resolveAcceleratorMap({});

  it('nests layout and footer panel checkboxes under an Appearance submenu', () => {
    const item = buildAppearanceMenuItems(
      window,
      true,
      false,
      true,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      true,
      false,
      true,
      false,
      false,
      true,
      accelerators
    );

    expect(item.label).toBe('Appearance');
    const submenu = item.submenu as MenuItemConstructorOptions[];
    expect(submenu).toHaveLength(18);
    expect(submenu[6]).toEqual({ type: 'separator' });
    expect(submenu[11]).toEqual({ type: 'separator' });

    const sidebarItem = submenu.find(
      (entry) => entry.label === 'Collections Sidebar'
    ) as MenuItemConstructorOptions;
    const responseItem = submenu.find(
      (entry) => entry.label === 'Response'
    ) as MenuItemConstructorOptions;
    const shortcutsItem = submenu.find(
      (entry) => entry.label === 'Shortcuts'
    ) as MenuItemConstructorOptions;
    const consoleItem = submenu.find(
      (entry) => entry.label === 'Console'
    ) as MenuItemConstructorOptions;
    const variablesItem = submenu.find(
      (entry) => entry.label === 'Variables'
    ) as MenuItemConstructorOptions;
    const mcpItem = submenu.find((entry) => entry.label === 'MCP') as MenuItemConstructorOptions;
    const terminalItem = submenu.find(
      (entry) => entry.label === 'Terminal'
    ) as MenuItemConstructorOptions;
    const storageLocationsItem = submenu.find(
      (entry) => entry.label === 'Storage locations'
    ) as MenuItemConstructorOptions;
    const colorMarkersItem = submenu.find(
      (entry) => entry.label === 'Color markers'
    ) as MenuItemConstructorOptions;
    const highlightsItem = submenu.find(
      (entry) => entry.label === 'Highlights'
    ) as MenuItemConstructorOptions;
    const indicatorsItem = submenu.find(
      (entry) => entry.label === 'Indicators'
    ) as MenuItemConstructorOptions;
    const filtersItem = submenu.find(
      (entry) => entry.label === 'Filters'
    ) as MenuItemConstructorOptions;
    const sortingItem = submenu.find(
      (entry) => entry.label === 'Sorting'
    ) as MenuItemConstructorOptions;

    expect(sidebarItem.type).toBe('checkbox');
    expect(sidebarItem.checked).toBe(true);
    expect(responseItem.checked).toBe(false);
    expect(shortcutsItem.checked).toBe(true);
    expect(shortcutsItem.accelerator).toBe(accelerators.get('toggle-shortcuts-sidebar'));
    expect(consoleItem.checked).toBe(false);
    expect(consoleItem.accelerator).toBe(accelerators.get('toggle-console'));
    expect(variablesItem.checked).toBe(true);
    expect(variablesItem.accelerator).toBe(accelerators.get('toggle-variables'));
    expect(mcpItem.checked).toBe(false);
    expect(mcpItem.accelerator).toBe(accelerators.get('toggle-mcp'));
    expect(terminalItem.checked).toBe(true);
    expect(terminalItem.accelerator).toBe(accelerators.get('toggle-terminal'));
    expect(storageLocationsItem.checked).toBe(true);
    expect(storageLocationsItem.accelerator).toBe(accelerators.get('toggle-storage-locations'));
    expect(colorMarkersItem.checked).toBe(false);
    expect(colorMarkersItem.accelerator).toBe(accelerators.get('toggle-color-markers'));
    expect(highlightsItem.checked).toBe(true);
    expect(highlightsItem.accelerator).toBe(accelerators.get('toggle-highlights'));
    expect(indicatorsItem.checked).toBe(false);
    expect(indicatorsItem.accelerator).toBe(accelerators.get('toggle-indicators'));
    expect(filtersItem.checked).toBe(false);
    expect(filtersItem.accelerator).toBe(accelerators.get('toggle-filters'));
    expect(sortingItem.checked).toBe(true);
    expect(sortingItem.accelerator).toBe(accelerators.get('toggle-sorting'));
  });
});
