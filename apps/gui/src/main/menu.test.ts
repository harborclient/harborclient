import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';
import { resolveAcceleratorMap } from '@harborclient/core/shortcuts';

const buildFromTemplate = vi.hoisted(() =>
  vi.fn((template: MenuItemConstructorOptions[]) => template)
);

vi.mock('electron', () => ({
  Menu: {
    buildFromTemplate: (template: MenuItemConstructorOptions[]) => buildFromTemplate(template)
  },
  shell: {
    openExternal: vi.fn()
  }
}));

vi.mock('#/main/settings/shortcutSettings', () => ({
  getShortcutOverrides: () => ({})
}));

vi.mock('#/main/plugins/pluginMenuContributions', () => ({
  getPluginMenuContributions: () => []
}));

vi.mock('#/main/plugins/pluginMenuMerge', () => ({
  mergePluginMenuItemsIntoTemplate: (template: MenuItemConstructorOptions[]) => template
}));

vi.mock('#/main/devMode', () => ({
  isDeveloperToolsEnabled: () => false
}));

vi.mock('#/main/window/zoom', () => ({
  stepZoomIn: vi.fn(),
  stepZoomOut: vi.fn(),
  resetZoom: vi.fn()
}));

describe('buildMenu View hide/show/switch sidebars', () => {
  it('places Hide, Show, and Switch sidebars after Theme with accelerators', async () => {
    const { buildMenu } = await import('./menu');
    const window = {
      webContents: { send: vi.fn() }
    } as unknown as BrowserWindow;
    const accelerators = resolveAcceleratorMap({});

    buildMenu(window);

    const template = buildFromTemplate.mock.calls[0]?.[0] as MenuItemConstructorOptions[];
    const viewMenu = template.find((entry) => entry.label === 'View');
    const submenu = viewMenu?.submenu as MenuItemConstructorOptions[];

    const themeIndex = submenu.findIndex((entry) => entry.label === 'Theme');
    expect(themeIndex).toBeGreaterThanOrEqual(0);

    const hideItem = submenu[themeIndex + 1] as MenuItemConstructorOptions;
    const showItem = submenu[themeIndex + 2] as MenuItemConstructorOptions;
    const switchItem = submenu[themeIndex + 3] as MenuItemConstructorOptions;
    const separator = submenu[themeIndex + 4] as MenuItemConstructorOptions;

    expect(hideItem.label).toBe('Hide sidebars');
    expect(hideItem.accelerator).toBe(accelerators.get('hide-sidebars'));
    expect(showItem.label).toBe('Show sidebars');
    expect(showItem.accelerator).toBe(accelerators.get('show-sidebars'));
    expect(switchItem.label).toBe('Switch sidebars');
    expect(switchItem.accelerator).toBe(accelerators.get('switch-sidebars'));
    expect(separator).toEqual({ type: 'separator' });

    (hideItem.click as () => void)();
    expect(window.webContents.send).toHaveBeenCalledWith('menu:action', 'hide-sidebars');

    (showItem.click as () => void)();
    expect(window.webContents.send).toHaveBeenCalledWith('menu:action', 'show-sidebars');

    (switchItem.click as () => void)();
    expect(window.webContents.send).toHaveBeenCalledWith('menu:action', 'switch-sidebars');
  });
});
