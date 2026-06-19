import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron';
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
 * Builds the application menu with File, Edit, View, and Help menus.
 *
 * @param window - Browser window that receives custom menu actions.
 * @returns The constructed application menu.
 */
export function buildMenu(window: BrowserWindow): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Request',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendMenuAction(window, 'new-request')
        },
        {
          label: 'New Collection',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => sendMenuAction(window, 'new-collection')
        },
        {
          label: 'Import',
          click: () => sendMenuAction(window, 'import')
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendMenuAction(window, 'settings')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [{ role: 'undo' }, { role: 'redo' }]
    },
    {
      label: 'View',
      submenu: [{ role: 'togglefullscreen' }, { role: 'zoomIn' }, { role: 'zoomOut' }]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => sendMenuAction(window, 'about')
        }
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}
