import { BrowserWindow } from 'electron';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for frameless Linux window chrome controls.
 */
export function registerWindowHandlers(): void {
  // Minimizes the focused application window.
  handle('window:minimize', ipcArgSchemas.none, () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  });

  // Toggles maximize on the focused application window.
  handle('window:toggleMaximize', ipcArgSchemas.none, () => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return;

    if (window.isMaximized()) {
      window.unmaximize();
      return;
    }

    window.maximize();
  });

  // Closes the focused application window.
  handle('window:close', ipcArgSchemas.none, () => {
    BrowserWindow.getFocusedWindow()?.close();
  });
}
