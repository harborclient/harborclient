import { BrowserWindow, Menu } from 'electron';
import { activateAppSubmenuItem, getAppSubmenuSnapshot } from '#/main/appMenuSnapshot';
import {
  setMenuAiSidebarVisible,
  setMenuGitSidebarVisible,
  setMenuRequestEditorVisible,
  setMenuResponseEditorVisible,
  setMenuSidebarVisible,
  setMenuShortcutsReferenceOpen,
  setMenuConsoleVisible,
  setMenuVariablesVisible,
  setMenuMcpVisible,
  setMenuTerminalVisible,
  setMenuDesignerUndoRedo,
  setMenuTabGroupAvailable,
  setMenuSidebarDeselectAllAvailable,
  setMenuGitCollectionActive,
  setMenuThemeMenuState
} from '#/main/appMenu';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import type { ThemeMenuOption } from '@harborclient/core/themes';
import type { ThemeSource } from '@harborclient/core/types';

/**
 * Registers IPC handlers that keep the application menu in sync with renderer state.
 */
export function registerMenuHandlers(): void {
  // Updates the View > Appearance submenu checkmark for sidebar visibility.
  handle('menu:setSidebarVisible', ipcArgSchemas.menuSidebarVisible, (_event, visible) => {
    setMenuSidebarVisible(visible);
  });

  // Updates the View > Appearance submenu checkmark for AI sidebar visibility.
  handle('menu:setAiSidebarVisible', ipcArgSchemas.menuAiSidebarVisible, (_event, visible) => {
    setMenuAiSidebarVisible(visible);
  });

  // Updates the View > Appearance submenu checkmark for Git sidebar visibility.
  handle('menu:setGitSidebarVisible', ipcArgSchemas.menuGitSidebarVisible, (_event, visible) => {
    setMenuGitSidebarVisible(visible);
  });

  // Updates the View > Appearance submenu checkmark for request editor visibility.
  handle(
    'menu:setRequestEditorVisible',
    ipcArgSchemas.menuRequestEditorVisible,
    (_event, visible) => {
      setMenuRequestEditorVisible(visible);
    }
  );

  // Updates the View > Appearance submenu checkmark for response editor visibility.
  handle(
    'menu:setResponseEditorVisible',
    ipcArgSchemas.menuResponseEditorVisible,
    (_event, visible) => {
      setMenuResponseEditorVisible(visible);
    }
  );

  // Updates the View > Appearance submenu checkmark for the shortcuts reference modal.
  handle(
    'menu:setShortcutsReferenceOpen',
    ipcArgSchemas.menuShortcutsReferenceOpen,
    (_event, open) => {
      setMenuShortcutsReferenceOpen(open);
    }
  );

  // Updates the View > Appearance submenu checkmark for console panel visibility.
  handle('menu:setConsoleVisible', ipcArgSchemas.menuConsoleVisible, (_event, visible) => {
    setMenuConsoleVisible(visible);
  });

  // Updates the View > Appearance submenu checkmark for variables panel visibility.
  handle('menu:setVariablesVisible', ipcArgSchemas.menuVariablesVisible, (_event, visible) => {
    setMenuVariablesVisible(visible);
  });

  // Updates the View > Appearance submenu checkmark for MCP panel visibility.
  handle('menu:setMcpVisible', ipcArgSchemas.menuMcpVisible, (_event, visible) => {
    setMenuMcpVisible(visible);
  });

  // Updates the View > Appearance submenu checkmark for terminal panel visibility.
  handle('menu:setTerminalVisible', ipcArgSchemas.menuTerminalVisible, (_event, visible) => {
    setMenuTerminalVisible(visible);
  });

  // Updates View menu theme checkmarks and plugin theme entries from renderer state.
  handle('menu:setThemeMenuState', ipcArgSchemas.menuThemeMenuState, (_event, theme, options) => {
    setMenuThemeMenuState(theme as ThemeSource, options as ThemeMenuOption[]);
  });

  // Updates Edit menu undo/redo ownership and enabled state for the Designer tab.
  handle(
    'menu:setDesignerUndoRedo',
    ipcArgSchemas.menuDesignerUndoRedo,
    (_event, active, canUndo, canRedo) => {
      setMenuDesignerUndoRedo(active, canUndo, canRedo);
    }
  );

  handle('menu:setTabGroupAvailable', ipcArgSchemas.menuTabGroupAvailable, (_event, available) => {
    setMenuTabGroupAvailable(available);
  });

  handle(
    'menu:setSidebarDeselectAllAvailable',
    ipcArgSchemas.menuSidebarDeselectAllAvailable,
    (_event, available) => {
      setMenuSidebarDeselectAllAvailable(available);
    }
  );

  handle('menu:setGitCollectionActive', ipcArgSchemas.menuGitCollectionActive, (_event, active) => {
    setMenuGitCollectionActive(active);
  });

  // Returns a serializable snapshot of a root application submenu for Linux in-app menus.
  handle('menu:getSubmenuSnapshot', ipcArgSchemas.menuGetSubmenuSnapshot, (_event, label) => {
    return getAppSubmenuSnapshot(label);
  });

  // Activates an item from a root application submenu snapshot by index.
  handle(
    'menu:activateSubmenuItem',
    ipcArgSchemas.menuActivateSubmenuItem,
    (event, label, index, nestedIndex) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) {
        return;
      }

      activateAppSubmenuItem(label, index, window, event.sender, nestedIndex);
    }
  );

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
