import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, screen, shell } from 'electron';
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
  listDatabaseConnections,
  setActiveDatabaseId
} from '#/main/settings/databaseSettings';
import { ensureDatabaseSlots } from '#/main/settings/databaseSlots';
import { migrateTeamHubSettings } from '#/main/settings/teamHubMigration';
import { listTeamHubs } from '#/main/settings/teamHubSettings';
import { ensureInviteKeys } from '#/main/invite/inviteKeys';
import { buildMenu } from '#/main/menu';
import { setMenuWindow } from '#/main/appMenu';
import { isVerbose, logVerbose } from '#/main/logger';
import {
  loadWindowState,
  restoreWindowPresentation,
  saveWindowState,
  trackWindowState
} from '#/main/window/windowState';
import type { DatabaseConnection, ThemeSource } from '#/shared/types';

const isDev = !app.isPackaged;

const THEME_SETTING_KEY = 'theme';
const MIN_SPLASH_MS = 600;
const SPLASH_WIDTH = 420;
const SPLASH_HEIGHT = 260;

let db: IDatabase;

type CloseReason = 'window' | 'app';

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let isQuitting = false;
let closePromptOpen = false;
let closeReason: CloseReason | null = null;

/**
 * Resolves the SQLite connection used as the local fallback provider.
 *
 * @param connections - Persisted database connections.
 * @returns SQLite connection configuration, or a synthetic fallback when none exists.
 */
function resolveSqliteFallbackConnection(connections: DatabaseConnection[]): DatabaseConnection {
  return (
    connections.find((conn) => conn.type === 'sqlite') ?? {
      id: 'fallback-sqlite',
      name: 'SQLite',
      type: 'sqlite',
      settings: getSqliteFallbackSettings()
    }
  );
}

/**
 * Mounts the SQLite fallback provider when the preferred default is unavailable.
 *
 * @param router - Routing database to mount into.
 * @param connections - Persisted database connections.
 * @param slots - Connection id to slot map.
 * @param userDataPath - Electron userData path for SQLite file storage.
 * @returns True when SQLite was mounted successfully.
 */
async function mountSqliteFallback(
  router: RoutingDatabase,
  connections: DatabaseConnection[],
  slots: Record<string, number>,
  userDataPath: string
): Promise<boolean> {
  const sqliteConnection = resolveSqliteFallbackConnection(connections);

  if (router.isConnectionMounted(sqliteConnection.id)) {
    router.setDefaultDataConnectionId(sqliteConnection.id);
    return true;
  }

  try {
    const sqliteDb = await createDatabaseInstance(sqliteConnection, userDataPath);
    const slot = slots[sqliteConnection.id] ?? 0;
    router.mount(slot, sqliteConnection, sqliteDb);
    router.setDefaultDataConnectionId(sqliteConnection.id);
    return true;
  } catch (err) {
    console.warn('Failed to mount SQLite fallback provider:', err);
    return false;
  }
}

/**
 * Points persisted and runtime defaults at a mounted provider when the active
 * connection could not be opened (for example incomplete remote settings).
 *
 * @param router - Initialized routing database.
 * @param connections - Persisted database connections.
 */
function reconcileActiveDatabaseSelection(
  router: RoutingDatabase,
  connections: DatabaseConnection[]
): void {
  const activeId = getActiveDatabaseId();
  if (router.isConnectionMounted(activeId)) {
    return;
  }

  const sqliteConnection = connections.find((conn) => conn.type === 'sqlite');
  const fallbackId =
    (sqliteConnection && router.isConnectionMounted(sqliteConnection.id)
      ? sqliteConnection.id
      : undefined) ?? connections.find((conn) => router.isConnectionMounted(conn.id))?.id;

  if (!fallbackId) {
    return;
  }

  setActiveDatabaseId(fallbackId);
  router.setDefaultDataConnectionId(fallbackId);
  console.warn(
    `Active database "${activeId}" is unavailable; using "${fallbackId}" for this session.`
  );
}

/**
 * Creates and initializes the routing database with all configured backends mounted.
 *
 * @returns Initialized routing database instance.
 */
async function createDatabase(): Promise<RoutingDatabase> {
  const userDataPath = app.getPath('userData');
  logVerbose('createDatabase: userData path', userDataPath);
  const registry = await initLocalRegistry(userDataPath);
  logVerbose('createDatabase: local registry initialized');
  migrateTeamHubSettings(registry, userDataPath);
  const connections = listDatabaseConnections();
  const teamHubs = listTeamHubs();
  const primaryConnectionId = getActiveDatabaseId();
  logVerbose(
    `createDatabase: ${connections.length} connection(s), ${teamHubs.length} team hub(s), active="${primaryConnectionId}"`
  );
  const slots = ensureDatabaseSlots(
    connections,
    primaryConnectionId,
    teamHubs.map((hub) => hub.id)
  );

  let router: RoutingDatabase;
  try {
    logVerbose('createDatabase: mounting routing database backends');
    router = await RoutingDatabase.create(
      registry,
      primaryConnectionId,
      connections,
      teamHubs,
      slots,
      userDataPath
    );
    logVerbose('createDatabase: routing database created');
  } catch (err) {
    console.warn('Failed to initialize routing database; falling back to SQLite provider:', err);
    router = new RoutingDatabase(registry, primaryConnectionId, userDataPath);
    await mountSqliteFallback(router, connections, slots, userDataPath);
  }

  if (!router.hasDefaultProvider()) {
    await mountSqliteFallback(router, connections, slots, userDataPath);
  }

  reconcileActiveDatabaseSelection(router, connections);

  if (!router.hasAnyBackend()) {
    console.warn(
      'No database providers could be mounted; continuing startup with registry-only storage.'
    );
  }

  const activeConnection = getActiveDatabaseConnection();
  const sqliteSettings =
    activeConnection.type === 'sqlite' ? activeConnection.settings : getSqliteFallbackSettings();
  const legacyProviderDbPath = join(userDataPath, sqliteSettings.dbFilename);

  setSplashStatus('Loading metadata...');
  logVerbose('createDatabase: running registry migration if needed', legacyProviderDbPath);
  try {
    await router.migrateRegistryIfNeeded(legacyProviderDbPath);
    logVerbose('createDatabase: registry migration complete');
  } catch (err) {
    console.warn('Database metadata migration failed; continuing startup without migration:', err);
  }

  return router;
}

/**
 * Maps a persisted theme preference to Electron's nativeTheme.themeSource.
 *
 * High contrast is stored separately but applied as dark so native chrome and
 * prefers-color-scheme consumers stay on the dark palette.
 *
 * @param theme - Persisted theme preference.
 * @returns Value suitable for nativeTheme.themeSource.
 */
function resolveNativeThemeSource(theme: ThemeSource): 'light' | 'dark' | 'system' {
  return theme === 'high-contrast' ? 'dark' : theme;
}

/**
 * Applies a persisted or default theme to nativeTheme.
 */
async function applyPersistedTheme(): Promise<void> {
  const stored = await db.getSetting(THEME_SETTING_KEY);
  const theme: ThemeSource =
    stored === 'light' || stored === 'dark' || stored === 'system' || stored === 'high-contrast'
      ? stored
      : 'system';
  nativeTheme.themeSource = resolveNativeThemeSource(theme);
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
 * Resolves the splash page file path for dev and packaged builds.
 * Uses loadFile (not the Vite dev server) because splash is fully self-contained.
 *
 * @returns Absolute path to splash.html.
 */
function resolveSplashPath(): string {
  if (isDev) {
    return join(__dirname, '../../src/renderer/splash.html');
  }
  return join(__dirname, '../renderer/splash.html');
}

/**
 * Waits for a fixed duration (used to avoid splash flicker on fast startups).
 *
 * @param ms - Delay in milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Updates the status line on the splash window when it is visible.
 *
 * @param message - Human-readable startup step description.
 */
function setSplashStatus(message: string): void {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  const escaped = JSON.stringify(message);
  void splashWindow.webContents.executeJavaScript(
    `document.getElementById('status').textContent = ${escaped}`
  );
}

/**
 * Resolves a solid window background for the splash on platforms without transparency.
 *
 * @returns Hex color matching the current light/dark preference.
 */
function resolveSplashBackgroundColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#f5f5f7';
}

/**
 * Computes splash coordinates centered on the display where the main window
 * will restore. On multi-monitor setups this keeps the splash on the same
 * screen as the main window instead of always landing on the primary display.
 *
 * @returns Top-left x/y for the splash window.
 */
function resolveSplashPosition(): { x: number; y: number } {
  const state = loadWindowState();
  const { workArea } = screen.getDisplayMatching({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height
  });

  return {
    x: Math.round(workArea.x + (workArea.width - SPLASH_WIDTH) / 2),
    y: Math.round(workArea.y + (workArea.height - SPLASH_HEIGHT) / 2)
  };
}

/**
 * Creates and shows the frameless startup splash window.
 *
 * @returns The splash browser window after its page has loaded.
 */
async function createSplashWindow(): Promise<BrowserWindow> {
  const useTransparency = process.platform === 'darwin';
  const { x, y } = resolveSplashPosition();
  const window = new BrowserWindow({
    width: SPLASH_WIDTH,
    height: SPLASH_HEIGHT,
    x,
    y,
    frame: false,
    transparent: useTransparency,
    backgroundColor: useTransparency ? undefined : resolveSplashBackgroundColor(),
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    show: false,
    icon: resolveAppIcon(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await window.loadFile(resolveSplashPath());

  window.show();
  window.focus();
  splashWindow = window;
  return window;
}

/**
 * Destroys the splash window if it is still open.
 */
function closeSplash(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy();
  }
  splashWindow = null;
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
    logVerbose('createWindow: main window ready-to-show, closing splash');
    closeSplash();
    window.show();
    restoreWindowPresentation(window, savedState);
    trackWindowState(window);
  });

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`Renderer failed to load (${errorCode} ${errorDescription}): ${validatedURL}`);
  });

  if (isVerbose) {
    window.webContents.on('did-finish-load', () => {
      logVerbose('createWindow: renderer finished loading');
    });
    window.webContents.on('render-process-gone', (_event, details) => {
      console.error('Renderer process gone:', details.reason, details.exitCode);
    });
  }

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  setupCloseHandlers(window);
  setupFullscreenEscapeHandler(window);

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    logVerbose('createWindow: loading renderer URL', process.env['ELECTRON_RENDERER_URL']);
    window.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    const indexPath = join(__dirname, '../renderer/index.html');
    logVerbose('createWindow: loading renderer file', indexPath);
    window.loadFile(indexPath);
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
  logVerbose('app ready: verbose logging enabled');
  await createSplashWindow();
  const splashStartedAt = Date.now();

  try {
    setSplashStatus('Starting up...');
    logVerbose('startup: ensuring invite keys');
    await ensureInviteKeys(app.getPath('userData'));

    setSplashStatus('Connecting to databases...');
    logVerbose('startup: initializing databases');
    db = await createDatabase();

    logVerbose('startup: applying persisted theme');
    await applyPersistedTheme();
    logVerbose('startup: registering IPC handlers');
    registerIpcHandlers(db);

    const elapsed = Date.now() - splashStartedAt;
    if (elapsed < MIN_SPLASH_MS) {
      await delay(MIN_SPLASH_MS - elapsed);
    }

    logVerbose('startup: creating main window');
    mainWindow = createWindow();
    setMenuWindow(mainWindow);
    Menu.setApplicationMenu(buildMenu(mainWindow));
    logVerbose('startup: main window created, waiting for ready-to-show');
  } catch (err) {
    closeSplash();
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
      setMenuWindow(mainWindow);
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
