import { describe, expect, it, vi } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';
import { mergePluginMenuItemsIntoTemplate } from './pluginMenuMerge';
import type { SerializableMenuContribution } from '#/shared/plugin/types';

describe('mergePluginMenuItemsIntoTemplate', () => {
  it('inserts plugin items into the matching menu with group separators', () => {
    const template: MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: [{ label: 'New Request' }, { type: 'separator' }, { role: 'quit' }]
      },
      {
        label: 'Help',
        submenu: [{ label: 'About' }]
      }
    ];

    const contributions: SerializableMenuContribution[] = [
      {
        pluginId: 'com.example.one',
        menu: 'file',
        command: 'one.command',
        label: 'One',
        group: 'alpha',
        order: 1
      },
      {
        pluginId: 'com.example.two',
        menu: 'file',
        command: 'two.command',
        label: 'Two',
        group: 'beta',
        order: 2
      },
      {
        pluginId: 'com.example.three',
        menu: 'help',
        command: 'three.command',
        label: 'Three'
      }
    ];

    const clicked: SerializableMenuContribution[] = [];
    mergePluginMenuItemsIntoTemplate(template, contributions, (contribution) => {
      clicked.push(contribution);
    });

    const fileSubmenu = template[0]?.submenu as MenuItemConstructorOptions[];
    expect(fileSubmenu).toHaveLength(6);
    expect(fileSubmenu[2]?.label).toBe('One');
    expect(fileSubmenu[3]).toEqual({ type: 'separator' });
    expect(fileSubmenu[4]?.label).toBe('Two');
    expect(fileSubmenu[5]).toEqual({ role: 'quit' });

    const helpSubmenu = template[1]?.submenu as MenuItemConstructorOptions[];
    expect(helpSubmenu).toHaveLength(3);
    expect(helpSubmenu[1]).toEqual({ type: 'separator' });
    expect(helpSubmenu[2]?.label).toBe('Three');

    fileSubmenu[2]?.click?.({} as never, {} as never, {} as never);
    expect(clicked).toEqual([contributions[0]]);
  });

  it('places plugin file menu items above Quit without duplicating separators', () => {
    const template: MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: [{ label: 'Import' }, { type: 'separator' }, { role: 'quit' }]
      }
    ];

    mergePluginMenuItemsIntoTemplate(
      template,
      [
        {
          pluginId: 'com.harborclient.plugins.openapi',
          menu: 'file',
          command: 'openapi.import',
          label: 'Import OpenAPI',
          group: 'import'
        }
      ],
      vi.fn()
    );

    const fileSubmenu = template[0]?.submenu as MenuItemConstructorOptions[];
    expect(fileSubmenu.map((item) => item.label ?? item.role ?? item.type)).toEqual([
      'Import',
      'separator',
      'Import OpenAPI',
      'quit'
    ]);
  });

  it('ignores contributions for menus that are not in the template', () => {
    const template: MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: []
      }
    ];

    mergePluginMenuItemsIntoTemplate(
      template,
      [
        {
          pluginId: 'com.example.one',
          menu: 'view',
          command: 'missing',
          label: 'Missing'
        }
      ],
      vi.fn()
    );

    expect(template[0]?.submenu).toEqual([]);
  });
});
