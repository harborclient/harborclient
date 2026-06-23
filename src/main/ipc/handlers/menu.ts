import { BrowserWindow, Menu } from 'electron';
import { setMenuAiSidebarVisible, setMenuSidebarVisible } from '#/main/appMenu';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

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
