import { BrowserWindow } from 'electron';
import { isDeveloperToolsEnabled } from '#/main/devMode';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { getRegisteredMainWindow, requestMainWindowReveal } from '#/main/window/mainWindowReveal';

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

  // Toggles native fullscreen on the focused application window.
  handle('window:toggleFullscreen', ipcArgSchemas.none, () => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return;

    window.setFullScreen(!window.isFullScreen());
  });

  // Closes the focused application window.
  handle('window:close', ipcArgSchemas.none, () => {
    BrowserWindow.getFocusedWindow()?.close();
  });

  // Moves keyboard focus from a Live Page guest back to the main renderer shell.
  handle('window:focusRenderer', ipcArgSchemas.none, () => {
    const window = getRegisteredMainWindow() ?? BrowserWindow.getFocusedWindow();
    if (!window || window.isDestroyed()) {
      return;
    }
    window.webContents.focus();
  });

  // Reveals the main window after renderer shell bootstrap completes.
  handle('window:notifyUiReady', ipcArgSchemas.none, (event) => {
    const registered = getRegisteredMainWindow();
    if (!registered || event.sender !== registered.webContents) {
      return;
    }
    requestMainWindowReveal('renderer');
  });

  // Inspects the DOM node at viewport coordinates and opens DevTools when enabled.
  handle('window:inspectElement', ipcArgSchemas.inspectElement, (event, point) => {
    if (!isDeveloperToolsEnabled()) {
      return;
    }

    const webContents = event.sender;
    webContents.inspectElement(point.x, point.y);
    if (!webContents.isDevToolsOpened()) {
      webContents.openDevTools();
    }
  });
}
