import { BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { getShortcutOverrides } from '#/main/settings/shortcutSettings';
import { resolveAcceleratorMap, type ShortcutId } from '#/shared/shortcuts';
import type { MenuActionId } from '#/shared/types';

/**
 * Sends a menu action to the renderer process.
 *
 * @param window - Target browser window.
 * @param action - Menu action identifier.
 */
function sendMenuAction(window: BrowserWindow, action: MenuActionId): void {
  window.webContents.send('menu:action', action);
}

/**
 * Returns the effective accelerator for a shortcut id.
 *
 * @param accelerators - Resolved accelerator map.
 * @param id - Shortcut identifier.
 * @returns Electron accelerator string.
 */
function acceleratorFor(accelerators: Map<ShortcutId, string>, id: ShortcutId): string {
  return accelerators.get(id) ?? '';
}

/**
 * Builds the application menu with File, Edit, View, and Help menus.
 *
 * @param window - Browser window that receives custom menu actions.
 * @param sidebarVisible - Whether the sidebar checkbox should appear checked.
 * @param aiSidebarVisible - Whether the AI sidebar checkbox should appear checked.
 * @returns The constructed application menu.
 */
export function buildMenu(
  window: BrowserWindow,
  sidebarVisible = true,
  aiSidebarVisible = false
): Menu {
  const accelerators = resolveAcceleratorMap(getShortcutOverrides());

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Request',
          accelerator: acceleratorFor(accelerators, 'new-request'),
          click: () => sendMenuAction(window, 'new-request')
        },
        {
          label: 'New Collection',
          accelerator: acceleratorFor(accelerators, 'new-collection'),
          click: () => sendMenuAction(window, 'new-collection')
        },
        {
          label: 'Sync Storage',
          click: () => sendMenuAction(window, 'sync')
        },
        {
          label: 'Save Request',
          accelerator: acceleratorFor(accelerators, 'save'),
          click: () => sendMenuAction(window, 'save')
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: acceleratorFor(accelerators, 'settings'),
          click: () => sendMenuAction(window, 'settings')
        },
        {
          label: 'Team Hub',
          click: () => sendMenuAction(window, 'team-hubs')
        },
        { type: 'separator' },
        {
          label: 'Sharing Keys',
          click: () => sendMenuAction(window, 'sharing-keys')
        },
        {
          label: 'Join Shared Collection',
          click: () => sendMenuAction(window, 'join-shared-collection')
        },
        {
          label: 'Import',
          click: () => sendMenuAction(window, 'import')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', accelerator: acceleratorFor(accelerators, 'undo') },
        { role: 'redo', accelerator: acceleratorFor(accelerators, 'redo') },
        { type: 'separator' },
        { role: 'cut', accelerator: acceleratorFor(accelerators, 'cut') },
        { role: 'copy', accelerator: acceleratorFor(accelerators, 'copy') },
        { role: 'paste', accelerator: acceleratorFor(accelerators, 'paste') },
        { type: 'separator' },
        { role: 'selectAll', accelerator: acceleratorFor(accelerators, 'select-all') }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Sidebar',
          type: 'checkbox',
          checked: sidebarVisible,
          accelerator: acceleratorFor(accelerators, 'toggle-sidebar'),
          click: () => sendMenuAction(window, 'toggle-sidebar')
        },
        {
          label: 'AI',
          type: 'checkbox',
          checked: aiSidebarVisible,
          accelerator: acceleratorFor(accelerators, 'toggle-ai-sidebar'),
          click: () => sendMenuAction(window, 'toggle-ai-sidebar')
        },
        { type: 'separator' },
        {
          role: 'togglefullscreen',
          accelerator: acceleratorFor(accelerators, 'toggle-fullscreen')
        },
        { role: 'zoomIn', accelerator: acceleratorFor(accelerators, 'zoom-in') },
        { role: 'zoomOut', accelerator: acceleratorFor(accelerators, 'zoom-out') }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => void shell.openExternal('https://harborclient.com/')
        },
        {
          label: 'Check for Updates...',
          click: () => sendMenuAction(window, 'check-for-updates')
        },
        {
          label: 'About',
          click: () => sendMenuAction(window, 'about')
        }
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}
