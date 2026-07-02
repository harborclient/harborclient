import { BrowserWindow, Menu } from 'electron';
import {
  setMenuAiSidebarVisible,
  setMenuCollectionsVisible,
  setMenuEnvironmentsVisible,
  setMenuSidebarVisible,
  setMenuThemeMenuState
} from '#/main/appMenu';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import type { ThemeMenuOption } from '#/shared/themes';
import type { ThemeSource } from '#/shared/types';

/**
 * Registers IPC handlers that keep the application menu in sync with renderer state.
 */
export function registerMenuHandlers(): void {
  // Updates the View menu checkmark for sidebar visibility.
  handle('menu:setSidebarVisible', ipcArgSchemas.menuSidebarVisible, (_event, visible) => {
    setMenuSidebarVisible(visible);
  });

  // Updates the View menu checkmark for AI sidebar visibility.
  handle('menu:setAiSidebarVisible', ipcArgSchemas.menuAiSidebarVisible, (_event, visible) => {
    setMenuAiSidebarVisible(visible);
  });

  // Updates the View menu checkmark for Collections section visibility.
  handle('menu:setCollectionsVisible', ipcArgSchemas.menuCollectionsVisible, (_event, visible) => {
    setMenuCollectionsVisible(visible);
  });

  // Updates the View menu checkmark for Environments section visibility.
  handle(
    'menu:setEnvironmentsVisible',
    ipcArgSchemas.menuEnvironmentsVisible,
    (_event, visible) => {
      setMenuEnvironmentsVisible(visible);
    }
  );

  // Updates View menu theme checkmarks and plugin theme entries from renderer state.
  handle('menu:setThemeMenuState', ipcArgSchemas.menuThemeMenuState, (_event, theme, options) => {
    setMenuThemeMenuState(theme as ThemeSource, options as ThemeMenuOption[]);
  });

  // Shows an application menu submenu at screen coordinates.
  handle('menu:popupSubmenu', ipcArgSchemas.menuPopupSubmenu, (event, label, x, y) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const appMenu = Menu.getApplicationMenu();
    if (!window || !appMenu) return;

    const item = appMenu.items.find((entry) => entry.label === label);
    if (!item?.submenu) return;

    item.submenu.popup({ window, x: Math.round(x), y: Math.round(y) });
  });
}
