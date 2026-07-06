import { app, BrowserWindow, dialog, ipcMain, nativeTheme, screen, type App } from 'electron';
import { join, resolve } from 'path';
import { RoutingStorage } from '#/main/storage';
import { initLocalDatabase } from '#/main/storage/localDatabaseInstance';
import {
  seedDefaultContentIfNeeded,
  isSeedFlagEnabled,
  seedEchoCollectionIfMissing
} from '#/main/storage/seedDefaultContent';
import { createStorageInstance } from '#/main/storage/createStorageInstance';
import { registerIpcHandlers } from '#/main/ipc';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import {
  getActiveStorageId,
  getActiveStorageConnection,
  getSqliteFallbackSettings,
  listStorageConnections,
  setActiveStorageId
} from '#/main/settings/storageSettings';
import { ensureStorageSlots } from '#/main/settings/storageSlots';
import { migrateTeamHubSettings } from '#/main/settings/teamHubMigration';
import { migrateStorageSettingsKeys } from '#/main/settings/storageSettingsMigration';
import { listTeamHubs } from '#/main/settings/teamHubSettings';
import { ensureSharingKeys } from '#/main/sharing/sharingKeys';
import { startGitWatchers } from '#/main/git/gitWatcher';
import { rebuildAppMenu, setMenuActiveTheme, setMenuWindow } from '#/main/appMenu';
import { attachShortcutDispatch } from '#/main/shortcutDispatch';
import { isVerbose, logVerbose } from '#/main/logger';
import {
  loadWindowState,
  restoreWindowPresentation,
  saveWindowState,
  trackWindowState
} from '#/main/window/windowState';
import {
  attachRendererNavigationGuards,
  createRendererNavigationPolicy
} from '#/main/window/navigationSecurity';
import { attachDevContextMenu } from '#/main/window/devContextMenu';
import { isDevModeFlagEnabled, isDeveloperToolsEnabled } from '#/main/devMode';
import { isQuitWithoutWarningFlagEnabled } from '#/main/quitWithoutWarning';
import { getStartupThemeOverride } from '#/main/startupTheme';
import { disposeScriptRunner } from '#/main/scripting/scriptRunnerHost';
import {
  PluginManager,
  isDisablePluginsFlagEnabled,
  parseDevPluginPaths
} from '#/main/plugins/PluginManager';
import { disposePluginRunner } from '#/main/plugins/pluginRunnerHost';
import { getPluginUiBroker, initPluginUiBroker } from '#/main/plugins/PluginUiBroker';
import { bootstrapMcpHost } from '#/main/ipc/handlers/mcp';
import { disposeMcpHost, getMcpToolBridge } from '#/main/mcp';
import {
  ensureHarborPluginProtocolForSession,
  registerHarborPluginProtocol,
  registerHarborPluginScheme
} from '#/main/plugins/registerPluginProtocol';
import type { StorageConnection, ThemeSource } from '#/shared/types';
import { HARBOR_PROTOCOL, parseHarborDeepLink, type HarborDeepLink } from '#/shared/deepLink';

const isDev = !app.isPackaged;

const THEME_SETTING_KEY = 'theme';
const MIN_SPLASH_MS = 600;
const SPLASH_WIDTH = 500;
const SPLASH_HEIGHT = 400;

let db: RoutingStorage;
let pluginManager: PluginManager | undefined;

type CloseReason = 'window' | 'app';

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let isQuitting = false;
let closePromptOpen = false;
let closeReason: CloseReason | null = null;
let pendingDeepLink: HarborDeepLink | null = null;
let rendererReady = false;

/**
 * Registers HarborClient as the default handler for harborclient:// URLs.
 */
function registerProtocolClient(): void {
  if (process.platform === 'win32' && isDev) {
    app.setAsDefaultProtocolClient(HARBOR_PROTOCOL, process.execPath, [
      resolve(process.argv[1] ?? '.')
    ]);
    return;
  }

  app.setAsDefaultProtocolClient(HARBOR_PROTOCOL);
}

/**
 * Finds a harborclient:// URL in a process argv list.
 *
 * @param argv - Command-line arguments from startup or a second-instance launch.
 * @returns Matching deep-link URL when present.
 */
function findDeepLinkInArgv(argv: string[]): string | undefined {
  return argv.find((arg) => arg.startsWith(`${HARBOR_PROTOCOL}://`));
}

/**
 * Restores, shows, and focuses the main application window.
 */
function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

/**
 * Sends a parsed deep link to the renderer, or buffers it until the page loads.
 *
 * @param payload - Parsed deep-link action.
 */
function sendDeepLinkToRenderer(payload: HarborDeepLink): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingDeepLink = payload;
    return;
  }

  if (rendererReady && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send('app:deep-link', payload);
    return;
  }

  pendingDeepLink = payload;
}

/**
 * Delivers a buffered deep link after the renderer finishes its initial load.
 */
function flushPendingDeepLink(): void {
  if (!pendingDeepLink || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const payload = pendingDeepLink;
  pendingDeepLink = null;
  mainWindow.webContents.send('app:deep-link', payload);
}

/**
 * Validates and dispatches one harborclient:// URL to the renderer.
 *
 * @param url - Raw URL from the OS protocol handler or launch argv.
 */
function handleDeepLink(url: string): void {
  const payload = parseHarborDeepLink(url);
  if (!payload) {
    logVerbose('deep link: ignored unsupported URL', url);
    return;
  }

  logVerbose('deep link: handling', payload);
  focusMainWindow();
  sendDeepLinkToRenderer(payload);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    focusMainWindow();
    const url = findDeepLinkInArgv(argv);
    if (url) {
      handleDeepLink(url);
    }
  });
}

registerProtocolClient();
registerHarborPluginScheme();

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

/**
 * Resolves the SQLite connection used as the local fallback provider.
 *
 * @param connections - Persisted database connections.
 * @returns SQLite connection configuration, or a synthetic fallback when none exists.
 */
function resolveSqliteFallbackConnection(connections: StorageConnection[]): StorageConnection {
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
  router: RoutingStorage,
  connections: StorageConnection[],
  slots: Record<string, number>,
  userDataPath: string
): Promise<boolean> {
  const sqliteConnection = resolveSqliteFallbackConnection(connections);

  if (router.isConnectionMounted(sqliteConnection.id)) {
    router.setDefaultDataConnectionId(sqliteConnection.id);
    return true;
  }

  try {
    const sqliteDb = await createStorageInstance(sqliteConnection, userDataPath);
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
function reconcileActiveStorageSelection(
  router: RoutingStorage,
  connections: StorageConnection[]
): void {
  const activeId = getActiveStorageId();
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

  setActiveStorageId(fallbackId);
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
async function createStorage(): Promise<RoutingStorage> {
  const userDataPath = app.getPath('userData');
  logVerbose('createStorage: userData path', userDataPath);
  const database = await initLocalDatabase(userDataPath);
  logVerbose('createStorage: local database initialized');
  migrateTeamHubSettings(database, userDataPath);
  migrateStorageSettingsKeys(database);
  const connections = listStorageConnections();
  const teamHubs = listTeamHubs();
  const primaryConnectionId = getActiveStorageId();
  logVerbose(
    `createStorage: ${connections.length} connection(s), ${teamHubs.length} team hub(s), active="${primaryConnectionId}"`
  );
  const slots = ensureStorageSlots(
    connections,
    primaryConnectionId,
    teamHubs.map((hub) => hub.id)
  );

  let router: RoutingStorage;
  try {
    logVerbose('createStorage: mounting routing storage backends');
    router = await RoutingStorage.create(
      database,
      primaryConnectionId,
      connections,
      teamHubs,
      slots,
      userDataPath
    );
    logVerbose('createStorage: routing storage created');
  } catch (err) {
    console.warn('Failed to initialize routing storage; falling back to SQLite provider:', err);
    router = new RoutingStorage(database, primaryConnectionId, userDataPath);
    await mountSqliteFallback(router, connections, slots, userDataPath);
  }

  if (!router.hasDefaultProvider()) {
    await mountSqliteFallback(router, connections, slots, userDataPath);
  }

  reconcileActiveStorageSelection(router, connections);

  if (!router.hasAnyBackend()) {
    console.warn(
      'No storage providers could be mounted; continuing startup with local-database-only storage.'
    );
  }

  const activeConnection = getActiveStorageConnection();
  const sqliteSettings =
    activeConnection.type === 'sqlite' ? activeConnection.settings : getSqliteFallbackSettings();
  const legacyProviderDbPath = join(userDataPath, sqliteSettings.dbFilename);

  logVerbose(
    'createStorage: running collection registry migration if needed',
    legacyProviderDbPath
  );
  try {
    await router.migrateRegistryIfNeeded(legacyProviderDbPath);
    logVerbose('createStorage: collection registry migration complete');
  } catch (err) {
    console.warn('Storage metadata migration failed; continuing startup without migration:', err);
  }

  try {
    await seedDefaultContentIfNeeded(router, database);
    logVerbose('createStorage: default content seed complete');
  } catch (err) {
    console.warn('Default content seed failed; continuing startup without seed:', err);
  }

  if (isSeedFlagEnabled()) {
    try {
      const created = await seedEchoCollectionIfMissing(router);
      logVerbose(
        created
          ? 'createStorage: --seed imported HarborClient Echo collection'
          : 'createStorage: --seed skipped; HarborClient Echo already exists'
      );
    } catch (err) {
      console.warn('--seed failed; continuing startup without seed:', err);
    }
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
  if (theme === 'light' || theme === 'dark' || theme === 'system') {
    return theme;
  }
  return 'dark';
}

/**
 * Applies a persisted or default theme to nativeTheme.
 *
 * @returns The resolved persisted theme preference.
 */
async function applyPersistedTheme(): Promise<ThemeSource> {
  const stored = await db.getSetting(THEME_SETTING_KEY);
  const theme: ThemeSource =
    stored === 'light' ||
    stored === 'dark' ||
    stored === 'system' ||
    stored === 'high-contrast' ||
    stored?.startsWith('plugin:')
      ? (stored as ThemeSource)
      : 'system';
  nativeTheme.themeSource = resolveNativeThemeSource(theme);
  return theme;
}

/**
 * Marks the app as quitting and persists window geometry when a window is available.
 *
 * @param window - Window to save state from, when present and not destroyed.
 */
function beginQuitWithoutPrompt(window: BrowserWindow | null = mainWindow): void {
  isQuitting = true;
  if (window && !window.isDestroyed()) {
    saveWindowState(window);
  }
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
    if (isQuitWithoutWarningFlagEnabled()) {
      beginQuitWithoutPrompt(window);
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
 * Aligns Electron's Linux app_id / WM_CLASS with the installed .desktop entry.
 *
 * Scoped npm package names can drift from `desktopName`; explicit setting keeps
 * taskbar and dock icons matched to `harborclient.desktop`.
 */
function applyLinuxDesktopIdentity(): void {
  if (process.platform !== 'linux') {
    return;
  }
  // Runtime API exists on Linux; upstream @types/electron does not declare it yet.
  (app as App & { setDesktopName: (desktopName: string) => void }).setDesktopName('harborclient');
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
 * Resolves the splash page file path for packaged builds and preview mode.
 *
 * @returns Absolute path to the Vite-built `out/renderer/splash.html`.
 */
function resolveSplashPath(): string {
  return join(__dirname, '../renderer/splash.html');
}

/**
 * Loads the startup splash page.
 *
 * During `electron-vite dev` the renderer dev server serves `splash.html` with
 * resolved asset URLs. Loading a stale or missing `out/renderer/splash.html`
 * via `file://` in that mode often fails on Linux with `ERR_FAILED`.
 *
 * @param window - Splash browser window to load.
 */
async function loadSplashPage(window: BrowserWindow): Promise<void> {
  const devRendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (isDev && devRendererUrl) {
    const splashUrl = `${devRendererUrl}/splash.html`;
    logVerbose('createSplashWindow: loading splash URL', splashUrl);
    await window.loadURL(splashUrl);
    return;
  }

  const splashPath = resolveSplashPath();
  logVerbose('createSplashWindow: loading splash file', splashPath);
  await window.loadFile(splashPath);
}

/**
 * Writes the running app version into the already-loaded splash page.
 *
 * @param window - Splash browser window whose document should be updated.
 * @param version - Application version reported by Electron package metadata.
 */
async function setSplashVersion(window: BrowserWindow, version: string): Promise<void> {
  await window.webContents.executeJavaScript(
    `(function(v){var e=document.getElementById('app-version');if(e)e.textContent='Version '+v;})(${JSON.stringify(
      version
    )})`
  );
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
 * Resolves a solid window background from the current native light/dark preference.
 *
 * Used for splash and Linux frameless windows where the OS does not paint chrome.
 *
 * @returns Hex color matching the current light/dark preference.
 */
function resolveWindowBackgroundColor(): string {
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
    backgroundColor: useTransparency ? undefined : resolveWindowBackgroundColor(),
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    show: false,
    icon: resolveAppIcon(),
    webPreferences: {
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await loadSplashPage(window);
  await setSplashVersion(window, app.getVersion());

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
  rendererReady = false;
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
    backgroundColor: process.platform === 'linux' ? resolveWindowBackgroundColor() : '#f5f5f7',
    ...(process.platform === 'darwin' && {
      titleBarStyle: 'hiddenInset',
      vibrancy: 'sidebar',
      visualEffectState: 'active',
      transparent: true
    }),
    ...(process.platform === 'linux' && {
      frame: false
    }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  let revealed = false;

  /**
   * Closes the splash and shows the main window exactly once.
   *
   * Triggered by whichever of `ready-to-show` or `did-finish-load` fires first.
   * `ready-to-show` is the preferred signal (it fires after the first frame is
   * painted, avoiding a white flash), but some Linux window managers never emit
   * it. `did-finish-load` is a reliable fallback so startup cannot hang on the
   * splash screen. The guard keeps the reveal idempotent across both events and
   * any later reloads (for example Vite HMR in dev).
   *
   * @param trigger - Name of the event that initiated the reveal, for logging.
   */
  const revealMainWindow = (trigger: string): void => {
    if (revealed) return;
    revealed = true;
    logVerbose(`createWindow: revealing main window (${trigger}), closing splash`);
    closeSplash();
    window.show();
    restoreWindowPresentation(window, savedState);
    trackWindowState(window);
  };

  window.on('ready-to-show', () => revealMainWindow('ready-to-show'));

  window.webContents.on('did-finish-load', () => {
    logVerbose('createWindow: renderer finished loading');
    revealMainWindow('did-finish-load');
    rendererReady = true;
    flushPendingDeepLink();
  });

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`Renderer failed to load (${errorCode} ${errorDescription}): ${validatedURL}`);
  });

  if (isVerbose) {
    window.webContents.on('render-process-gone', (_event, details) => {
      console.error('Renderer process gone:', details.reason, details.exitCode);
    });
  }

  const indexPath = join(__dirname, '../renderer/index.html');
  const rendererRoot = join(__dirname, '../renderer');
  attachRendererNavigationGuards(
    window.webContents,
    createRendererNavigationPolicy({
      isDev,
      devRendererUrl: process.env['ELECTRON_RENDERER_URL'],
      indexPath,
      rendererRoot
    })
  );

  window.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    let url: URL;
    try {
      url = new URL(params.src);
    } catch {
      event.preventDefault();
      return;
    }
    if (url.protocol !== 'harbor-plugin:') {
      event.preventDefault();
      return;
    }

    const pluginId = decodeURIComponent(url.hostname);
    const role = url.searchParams.get('role') === 'view' ? 'view' : 'agent';
    const contrib = url.searchParams.get('contrib') ?? '';
    const kind = url.searchParams.get('kind') ?? '';
    const slot = url.searchParams.get('slot') ?? '';

    logVerbose('will-attach-webview: allow', { pluginId, role, src: params.src });
    ensureHarborPluginProtocolForSession(`persist:plugin-${pluginId}`);
    webPreferences.contextIsolation = true;
    webPreferences.nodeIntegration = false;
    webPreferences.sandbox = true;
    webPreferences.preload = join(__dirname, '../preload/plugin.js');
    webPreferences.additionalArguments = [
      `--plugin-id=${pluginId}`,
      `--plugin-role=${role}`,
      ...(contrib ? [`--plugin-contrib=${contrib}`] : []),
      ...(kind ? [`--plugin-kind=${kind}`] : []),
      ...(slot ? [`--plugin-slot=${slot}`] : [])
    ];
  });

  window.webContents.on('did-attach-webview', (_event, guestContents) => {
    guestContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    guestContents.on('did-finish-load', () => {
      logVerbose('plugin webview did-finish-load', { guestId: guestContents.id });
    });
    guestContents.on('destroyed', () => {
      try {
        getPluginUiBroker().clearSession(guestContents.id);
      } catch {
        // Broker is not initialized yet during early startup attaches.
      }
    });
    guestContents.on('render-process-gone', (_goneEvent, details) => {
      logVerbose('plugin webview render-process-gone', {
        guestId: guestContents.id,
        reason: details.reason,
        exitCode: details.exitCode
      });
      try {
        getPluginUiBroker().clearSession(guestContents.id);
      } catch {
        // Broker is not initialized yet during early startup attaches.
      }
    });
    guestContents.on('did-fail-load', (_failEvent, errorCode, errorDescription, validatedURL) => {
      logVerbose('plugin webview did-fail-load', {
        guestId: guestContents.id,
        errorCode,
        errorDescription,
        validatedURL
      });
    });
  });

  setupCloseHandlers(window);
  setupFullscreenEscapeHandler(window);
  attachShortcutDispatch(window);

  if (isDeveloperToolsEnabled()) {
    attachDevContextMenu(window);
  }

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
    logVerbose('createWindow: loading renderer URL', rendererUrl);
    // Vite serves optimized deps (node_modules/.vite/deps) with an immutable
    // Cache-Control header keyed on a ?v=<browserHash> query. That hash is
    // derived from the lockfile + config, not from `file:`-linked package
    // contents, so it stays constant when @harborclient/sdk is rebuilt locally.
    // Electron then keeps serving the stale cached body for the same URL,
    // producing "module does not provide an export named X" errors. Clearing
    // the dev session cache before load guarantees a fresh fetch.
    void window.webContents.session
      .clearCache()
      .catch(() => {
        // Best-effort; a stale cache only matters during local SDK development.
      })
      .finally(() => {
        window.loadURL(rendererUrl);
      });
  } else {
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
  applyLinuxDesktopIdentity();
  try {
    await createSplashWindow();
  } catch (err) {
    console.warn('Splash screen failed to load, continuing without it:', err);
  }
  const splashStartedAt = Date.now();

  try {
    logVerbose('startup: ensuring sharing keys');
    await ensureSharingKeys(app.getPath('userData'));

    logVerbose('startup: initializing storage');
    db = await createStorage();

    logVerbose('startup: applying persisted theme');
    const persistedTheme = await applyPersistedTheme();
    const startupTheme = getStartupThemeOverride();
    if (startupTheme != null) {
      nativeTheme.themeSource = resolveNativeThemeSource(startupTheme);
      logVerbose(`startup: --theme active; using ${startupTheme} for this session`);
    }
    const activeTheme = startupTheme ?? persistedTheme;

    logVerbose('startup: initializing plugin manager');
    if (isDevModeFlagEnabled()) {
      logVerbose('startup: --dev-mode active; developer tools enabled in packaged build');
    }
    const disableAllPlugins = isDisablePluginsFlagEnabled();
    if (disableAllPlugins) {
      logVerbose('startup: --disable-plugins active; all plugins will stay inactive');
    }
    if (isQuitWithoutWarningFlagEnabled()) {
      logVerbose('startup: --quit-without-warning active; unsaved changes will not block quit');
    }
    pluginManager = new PluginManager(app.getPath('userData'), app.getVersion(), {
      disableAllPlugins
    });
    pluginManager.discover();
    void pluginManager.refreshSignatures();
    pluginManager.registerStartupDevPaths(parseDevPluginPaths());

    logVerbose('startup: initializing plugin UI broker');
    const pluginUiBroker = initPluginUiBroker(pluginManager);
    pluginUiBroker.setMainWindow(() => mainWindow);
    getMcpToolBridge().setMainWindow(() => mainWindow);
    pluginUiBroker.setThemeGetter(async () => {
      const override = getStartupThemeOverride();
      if (override != null) {
        return override;
      }
      const value = await db.getSetting(THEME_SETTING_KEY);
      return (value ?? 'system') as ThemeSource;
    });
    registerHarborPluginProtocol(
      pluginManager,
      join(__dirname, '../..'),
      (pluginId) => {
        pluginUiBroker.markAgentReady(pluginId);
      },
      (pluginId, message) => {
        pluginUiBroker.markAgentFailed(pluginId, message);
      }
    );

    logVerbose('startup: registering IPC handlers');
    registerIpcHandlers(db, pluginManager);
    await bootstrapMcpHost();

    if (db instanceof RoutingStorage) {
      startGitWatchers(db, () => mainWindow);
    }

    const elapsed = Date.now() - splashStartedAt;
    if (elapsed < MIN_SPLASH_MS) {
      await delay(MIN_SPLASH_MS - elapsed);
    }

    logVerbose('startup: creating main window');
    mainWindow = createWindow();
    pluginManager.setNotifyWindow(() => mainWindow);
    setMenuWindow(mainWindow);
    setMenuActiveTheme(activeTheme);
    rebuildAppMenu();
    logVerbose('startup: main window created, waiting for ready-to-show');

    const startupDeepLink = findDeepLinkInArgv(process.argv);
    if (startupDeepLink) {
      handleDeepLink(startupDeepLink);
    }
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
      pluginManager?.setNotifyWindow(() => mainWindow);
      setMenuWindow(mainWindow);
      void db.getSetting(THEME_SETTING_KEY).then((stored) => {
        const theme: ThemeSource =
          stored === 'light' ||
          stored === 'dark' ||
          stored === 'system' ||
          stored === 'high-contrast' ||
          stored?.startsWith('plugin:')
            ? (stored as ThemeSource)
            : 'system';
        setMenuActiveTheme(theme);
        rebuildAppMenu();
      });
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
    return;
  }

  if (isQuitWithoutWarningFlagEnabled()) {
    beginQuitWithoutPrompt();
    return;
  }

  event.preventDefault();
  promptForClose('app');
});

/**
 * Disposes long-lived utility processes after all windows have closed so the
 * renderer can unload plugins while the runner is still active.
 */
app.on('will-quit', () => {
  disposeScriptRunner();
  disposePluginRunner();
  void disposeMcpHost();
  pluginManager?.dispose();
  void db.close();
});
