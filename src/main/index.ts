import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell } from 'electron';
import { join } from 'path';
import { RoutingDatabase } from '#/main/db';
import { initLocalRegistry } from '#/main/db/localRegistryInstance';
import { createDatabaseInstance } from '#/main/db/createDatabaseInstance';
import type { IDatabase } from '#/main/db/IDatabase';
import { registerIpcHandlers } from '#/main/ipc';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import {
  getActiveDatabaseId,
  getActiveDatabaseConnection,
  getSqliteFallbackSettings,
  listDatabaseConnections
} from '#/main/settings/databaseSettings';
import { ensureDatabaseSlots } from '#/main/settings/databaseSlots';
import { ensureInviteKeys } from '#/main/invite/inviteKeys';
import { buildMenu } from '#/main/menu';
import {
  loadWindowState,
  restoreWindowPresentation,
  saveWindowState,
  trackWindowState
} from '#/main/window/windowState';
import type { DatabaseConnection, ThemeSource } from '#/shared/types';

const isDev = !app.isPackaged;

const THEME_SETTING_KEY = 'theme';

let db: IDatabase;

type CloseReason = 'window' | 'app';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let closePromptOpen = false;
let closeReason: CloseReason | null = null;

/**
 * Creates and initializes the routing database with all configured backends mounted.
 *
 * @returns Initialized routing database instance.
 */
async function createDatabase(): Promise<RoutingDatabase> {
  const userDataPath = app.getPath('userData');
  const registry = await initLocalRegistry(userDataPath);
  const connections = listDatabaseConnections();
  const primaryConnectionId = getActiveDatabaseId();
  const slots = ensureDatabaseSlots(connections, primaryConnectionId);

  const router = await RoutingDatabase.create(
    registry,
    primaryConnectionId,
    connections,
    slots,
    userDataPath
  );

  if (!router.hasDefaultProvider()) {
    const sqliteConnection: DatabaseConnection = connections.find(
      (conn) => conn.type === 'sqlite'
    ) ?? {
      id: 'fallback-sqlite',
      name: 'SQLite',
      type: 'sqlite',
      settings: getSqliteFallbackSettings()
    };

    const sqliteDb = await createDatabaseInstance(sqliteConnection, userDataPath);
    const slot = slots[sqliteConnection.id] ?? 0;
    router.mount(slot, sqliteConnection, sqliteDb);
    router.setDefaultDataConnectionId(sqliteConnection.id);
  }

  if (!router.hasDefaultProvider()) {
    throw new Error('No database provider could be initialized.');
  }

  const activeConnection = getActiveDatabaseConnection();
  const sqliteSettings =
    activeConnection.type === 'sqlite' ? activeConnection.settings : getSqliteFallbackSettings();
  const legacyProviderDbPath = join(userDataPath, sqliteSettings.dbFilename);

  await router.migrateRegistryIfNeeded(legacyProviderDbPath);

  return router;
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
    if (isQuitting) {
      saveWindowState(window);
      return;
    }
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
    : join(__dirname, '../../images/logo-icon.png');
}

/**
 * Creates and configures the main application window.
 *
 * @returns The created browser window.
 */
function createWindow(): BrowserWindow {
  const savedState = loadWindowState();

  const window = new BrowserWindow({
    x: savedState.x,
    y: savedState.y,
    width: savedState.width,
    height: savedState.height,
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

  window.on('ready-to-show', () => {
    window.show();
    restoreWindowPresentation(window, savedState);
    trackWindowState(window);
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

ipcMain.on('app:close-decision', (_event, ...raw) => {
  closePromptOpen = false;

  const result = ipcArgSchemas.closeDecision.safeParse(raw);
  if (!result.success) {
    closeReason = null;
    return;
  }

  const [proceed] = result.data;
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
    await ensureInviteKeys(app.getPath('userData'));
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      saveWindowState(mainWindow);
    }
    void db.close();
    return;
  }

  event.preventDefault();
  promptForClose('app');
});
