import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron';

let tray: Tray | null = null;
let getMainWindow: (() => BrowserWindow | null) | null = null;
let focusMainWindow: (() => void) | null = null;
let resolveAppIcon: (() => string) | null = null;

/**
 * Wires the tray host to the main window and icon helpers.
 *
 * Must be called once during app startup before {@link syncTrayFromSettings}.
 *
 * @param options - Window accessors and icon path resolver.
 */
export function initTrayHost(options: {
  getMainWindow: () => BrowserWindow | null;
  focusMainWindow: () => void;
  resolveAppIcon: () => string;
}): void {
  getMainWindow = options.getMainWindow;
  focusMainWindow = options.focusMainWindow;
  resolveAppIcon = options.resolveAppIcon;
}

/**
 * Creates the system tray icon with Show and Quit actions.
 */
function createTray(): void {
  if (tray || !resolveAppIcon || !focusMainWindow) {
    return;
  }

  const icon = nativeImage.createFromPath(resolveAppIcon());
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('HarborClient');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show HarborClient',
        click: () => {
          focusMainWindow?.();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        }
      }
    ])
  );
  tray.on('click', () => {
    focusMainWindow?.();
  });
}

/**
 * Destroys the system tray icon when present.
 */
export function disposeTray(): void {
  if (!tray) {
    return;
  }
  tray.destroy();
  tray = null;
}

/**
 * Shows the main window when it exists and is currently hidden.
 *
 * Used when the user disables close-to-tray so they are not left without a
 * window or tray icon.
 */
function showMainWindowIfHidden(): void {
  const window = getMainWindow?.();
  if (!window || window.isDestroyed()) {
    return;
  }
  if (!window.isVisible()) {
    focusMainWindow?.();
  }
}

/**
 * Creates or destroys the system tray to match the close-to-tray preference.
 *
 * When the setting is turned off, any hidden main window is shown again so the
 * user is not stranded without a tray icon or window.
 *
 * @param closeToTray - Whether closing the window should hide to the tray.
 */
export function syncTrayFromSettings(closeToTray: boolean): void {
  if (closeToTray) {
    createTray();
    return;
  }

  const hadTray = tray != null;
  disposeTray();
  if (hadTray) {
    showMainWindowIfHidden();
  }
}
