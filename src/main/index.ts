import { app, BrowserWindow, Menu, nativeTheme, shell } from 'electron';
import windowStateKeeper from 'electron-window-state';
import { join } from 'path';
import { closeDb, getSetting, initDb } from '#/main/db';
import { registerIpcHandlers } from '#/main/ipc';
import { buildMenu } from '#/main/menu';
import type { ThemeSource } from '#/shared/types';

const isDev = !app.isPackaged;

const THEME_SETTING_KEY = 'theme';

/**
 * Applies a persisted or default theme to nativeTheme.
 */
function applyPersistedTheme(): void {
  const stored = getSetting(THEME_SETTING_KEY);
  const theme: ThemeSource =
    stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  nativeTheme.themeSource = theme;
}

// chrome-sandbox needs SUID (mode 4755), which fails on mounted/network filesystems
if (process.platform === 'linux' && isDev) {
  app.commandLine.appendSwitch('no-sandbox');
}

/**
 * Resolves the app icon path for dev and packaged builds.
 */
function resolveAppIcon(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../images/logo-square.png');
}

/**
 * Creates and configures the main application window.
 *
 * @returns The created browser window.
 */
function createWindow(): BrowserWindow {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1280,
    defaultHeight: 800
  });

  const mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 900,
    minHeight: 600,
    title: 'Harbor Client',
    icon: resolveAppIcon(),
    show: false,
    backgroundColor: '#f5f5f7',
    ...(process.platform === 'darwin' && {
      titleBarStyle: 'hiddenInset',
      vibrancy: 'sidebar',
      visualEffectState: 'active',
      transparent: true
    }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindowState.manage(mainWindow);

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

app.whenReady().then(() => {
  initDb(app.getPath('userData'));
  applyPersistedTheme();
  registerIpcHandlers();
  const mainWindow = createWindow();
  Menu.setApplicationMenu(buildMenu(mainWindow));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const window = createWindow();
      Menu.setApplicationMenu(buildMenu(window));
    }
  });
});

app.on('window-all-closed', () => {
  closeDb();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  closeDb();
});
