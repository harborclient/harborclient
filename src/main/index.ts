import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell } from 'electron';
import windowStateKeeper from 'electron-window-state';
import { join } from 'path';
import { FirestoreDatabase, MySqlDatabase, PostgresDatabase, SqliteDatabase } from '#/main/db';
import type { IDatabase } from '#/main/db/IDatabase';
import { registerIpcHandlers } from '#/main/ipc';
import { getActiveDatabaseConnection, getSqliteFallbackSettings } from '#/main/settings/databaseSettings';
import { buildMenu } from '#/main/menu';
import type { ThemeSource } from '#/shared/types';

const isDev = !app.isPackaged;

const THEME_SETTING_KEY = 'theme';

let db: IDatabase;

type CloseReason = 'window' | 'app';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let closePromptOpen = false;
let closeReason: CloseReason | null = null;

/**
 * Creates and initializes the configured database backend.
 *
 * @returns Initialized database instance.
 */
async function createDatabase(): Promise<IDatabase> {
  const connection = getActiveDatabaseConnection();

  if (connection.type === 'firestore') {
    try {
      const firestoreDb = new FirestoreDatabase(connection.settings);
      await firestoreDb.init();
      return firestoreDb;
    } catch (err) {
      console.error('Firestore init failed, falling back to SQLite:', err);
    }
  }

  if (connection.type === 'mysql') {
    try {
      const mysqlDb = new MySqlDatabase(connection.settings);
      await mysqlDb.init();
      return mysqlDb;
    } catch (err) {
      console.error('MySQL init failed, falling back to SQLite:', err);
    }
  }

  if (connection.type === 'postgres') {
    try {
      const postgresDb = new PostgresDatabase(connection.settings);
      await postgresDb.init();
      return postgresDb;
    } catch (err) {
      console.error('PostgreSQL init failed, falling back to SQLite:', err);
    }
  }

  if (connection.type === 'sqlite') {
    try {
      const sqliteDb = new SqliteDatabase(app.getPath('userData'), connection.settings);
      await sqliteDb.init();
      return sqliteDb;
    } catch (err) {
      throw new Error(`SQLite init failed: ${err instanceof Error ? err.message : String(err)}`, {
        cause: err
      });
    }
  }

  const sqliteSettings = getSqliteFallbackSettings();

  try {
    const sqliteDb = new SqliteDatabase(app.getPath('userData'), sqliteSettings);
    await sqliteDb.init();
    return sqliteDb;
  } catch (err) {
    throw new Error(`SQLite init failed: ${err instanceof Error ? err.message : String(err)}`, {
      cause: err
    });
  }
}

/**
 * Applies a persisted or default theme to nativeTheme.
 */
async function applyPersistedTheme(): Promise<void> {
  const stored = await db.getSetting(THEME_SETTING_KEY);
  const theme: ThemeSource =
    stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  nativeTheme.themeSource = theme;
}

/**
 * Prompts the renderer to confirm close/quit when not already quitting.
 *
 * @param reason - Whether the user closed the window or quit the app.
 */
function promptForClose(reason: CloseReason): void {
  if (!mainWindow || closePromptOpen || isQuitting) return;
  if (mainWindow.webContents.isLoading()) return;

  closePromptOpen = true;
  closeReason = reason;
  mainWindow.webContents.send('app:before-close');
}

/**
 * Registers close and quit handlers on a browser window.
 *
 * @param window - Main application window.
 */
function setupCloseHandlers(window: BrowserWindow): void {
  window.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    promptForClose('window');
  });
}

/**
 * Exits native fullscreen when the user presses Escape.
 *
 * @param window - Main application window.
 */
function setupFullscreenEscapeHandler(window: BrowserWindow): void {
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key !== 'Escape' || !window.isFullScreen()) return;
    window.setFullScreen(false);
    event.preventDefault();
  });
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

  const window = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 900,
    minHeight: 600,
    title: 'HarborClient',
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

  mainWindowState.manage(window);

  window.on('ready-to-show', () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  setupCloseHandlers(window);
  setupFullscreenEscapeHandler(window);

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}

ipcMain.on('app:close-decision', (_event, proceed: boolean) => {
  closePromptOpen = false;

  if (!proceed) {
    closeReason = null;
    return;
  }

  isQuitting = true;
  const reason = closeReason;
  closeReason = null;

  if (reason === 'app') {
    app.quit();
  } else {
    mainWindow?.close();
  }
});

app.whenReady().then(async () => {
  try {
    db = await createDatabase();
    await applyPersistedTheme();
    registerIpcHandlers(db);
    mainWindow = createWindow();
    Menu.setApplicationMenu(buildMenu(mainWindow));
  } catch (err) {
    console.error('Failed to initialize application:', err);
    dialog.showErrorBox(
      'Harbor Client failed to start',
      err instanceof Error ? err.message : String(err)
    );
    app.quit();
    return;
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      isQuitting = false;
      mainWindow = createWindow();
      Menu.setApplicationMenu(buildMenu(mainWindow));
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (isQuitting) {
    void db.close();
    return;
  }

  event.preventDefault();
  promptForClose('app');
});
