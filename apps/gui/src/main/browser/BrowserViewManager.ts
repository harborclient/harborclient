import { randomUUID } from 'crypto';
import { statSync } from 'fs';
import { basename } from 'path';
import { WebContentsView, dialog, net, shell, type Session } from 'electron';
import type {
  BrowserConsoleEntryPayload,
  BrowserDownloadEntry,
  BrowserHcScriptSourcePayload,
  BrowserHcScriptsPayload,
  BrowserInjectionScriptPayload,
  BrowserNavigationState,
  BrowserOpenImageViewPayload,
  BrowserOpenTabRequest,
  BrowserRequestDefaultsPayload,
  BrowserViewBounds,
  KeyValue,
  ScriptRunInput,
  SendResult
} from '@harborclient/core/types';
import { buildScriptRunInfo } from '@harborclient/core/types/script';
import { defaultAuth, normalizeAuth, type AuthConfig } from '@harborclient/core/auth';
import {
  cropPngToHeight,
  planFullPageCapture,
  stitchPngBuffers
} from '#/main/browser/stitchPngBuffers';
import { grantFilePathAccess } from '#/main/ipc/handlers/filePathAccess';
import {
  prependRecentDownload,
  removeRecentDownload,
  updateRecentDownload
} from '#/main/browser/browserRecentDownloads';
import {
  isCertificateFailLoadError,
  resolveBrowserSecurityState
} from '#/main/browser/browserSecurityState';
import { shouldAllowLiveServerCertificateError } from '#/main/browser/liveServerCertificatePolicy';
import { isLeaveBrowserUnloadChoice } from '#/main/browser/browserUnloadPrompt';
import { attachBrowserGuestContextMenu } from '#/main/browser/browserGuestContextMenu';
import { listRunningLiveServers } from '#/main/liveServer/liveServerHost';
import {
  selectScriptsForRunAt,
  type BrowserInjectionScript,
  type BrowserScriptRunAt
} from '#/browser/browserScripts';
import {
  buildBrowserPageResponseSnapshot,
  buildBrowserScriptRequest,
  applyBrowserScriptVariableResult,
  type BrowserHcScriptSource
} from '#/browser/browserHcScripts';
import {
  appendBrowserScriptResult,
  buildBrowserConsoleEntryPayload,
  createBrowserConsoleAccum,
  shouldEmitBrowserConsoleEntry,
  type BrowserConsoleAccum
} from '#/browser/browserConsoleEntry';
import { buildBrowserLoadURLOptions } from '#/browser/browserLoadURLOptions';
import {
  FAVICON_MAX_BYTES,
  FaviconCache,
  bytesToFaviconDataUrl,
  candidatesFromChromiumFavicons,
  candidatesFromScrapedLinks,
  defaultFaviconIcoUrl,
  faviconCacheKeyForUrl,
  faviconScrapeScript,
  isAcceptableFaviconContentType,
  isFaviconEligibleUrl
} from '#/browser/browserFavicon';
import { isAllowedBrowserUrl, toViewSourceUrl } from '#/browser/browserUrl';
import {
  buildBlobSrcToDataUrlScript,
  classifyBrowserGuestImageSrc,
  deriveImageFileNameFromSrcUrl
} from '#/browser/browserGuestImageContext';
import {
  buildBrowserDomQueryScript,
  type BrowserDomQueryOptions,
  type BrowserDomQueryResult
} from '#/browser/browserDomQuery';
import { isAllowedExternalUrl } from '#/main/window/navigationSecurity';
import { saveImageWithSaveDialog } from '#/main/ipc/handlers/saveImageWithSaveDialog';
import { logVerbose } from '#/main/logger';
import { runScriptInProcess } from '#/main/scripting/scriptRunnerHost';
import { tryDispatchActionShortcut } from '#/main/shortcutDispatch';
import { getRegisteredMainWindow } from '#/main/window/mainWindowReveal';

/**
 * Default timeout when waiting for a browser guest to finish loading.
 */
const DEFAULT_WAIT_FOR_LOAD_MS = 30_000;

/**
 * Shared short-lived favicon cache for all browser guests in this process.
 */
const faviconCache = new FaviconCache();

/**
 * Per-tab guest state tracked by {@link BrowserViewManager}.
 */
interface BrowserGuestSession {
  /**
   * WebContentsView attached to the main window content view.
   */
  view: WebContentsView;

  /**
   * Home URL for the Home control.
   */
  homeUrl: string;

  /**
   * Saved injection scripts applied on page-load hooks.
   */
  scripts: BrowserInjectionScript[];

  /**
   * Resolved pre-request hc.* scripts run before navigation.
   */
  preRequestScripts: BrowserHcScriptSource[];

  /**
   * Resolved post-request hc.* scripts run after did-finish-load.
   */
  postRequestScripts: BrowserHcScriptSource[];

  /**
   * Importable snippet modules for relative imports during bundling.
   */
  snippetModules: Record<string, string>;

  /**
   * Ambiguous snippet filenames that should fail import resolution.
   */
  snippetModuleConflicts: string[];

  /**
   * Merged runtime variables seeded into hc.request.variables for navigation scripts.
   */
  variables: Record<string, string>;

  /**
   * Headers applied on chrome-driven loadURL navigations.
   */
  headers: KeyValue[];

  /**
   * Authorization applied on chrome-driven loadURL navigations.
   */
  auth: AuthConfig;

  /**
   * User-Agent override for chrome-driven navigations; empty keeps Chromium default.
   */
  userAgent: string;

  /**
   * Whether the guest is currently shown.
   */
  visible: boolean;

  /**
   * Last bounds applied while visible (restored on show).
   */
  bounds: BrowserViewBounds;

  /**
   * Current tab-bar favicon data URL, or null when cleared / unresolved.
   */
  faviconDataUrl: string | null;

  /**
   * True when the in-flight or last navigation failed TLS certificate verification.
   */
  hasCertificateError: boolean;

  /**
   * Monotonic token bumped on each main-frame navigation to discard stale favicon work.
   */
  faviconGeneration: number;

  /**
   * Mutable object bag threaded across sequential browser scripts within one navigation.
   */
  scriptData: Record<string, unknown>;

  /**
   * UUID of the linked saved live page for hc.info.livepageId, or empty when unsaved.
   */
  livepageId: string;

  /**
   * Accumulates pre/post script output for the in-flight navigation console entry.
   *
   * Created when pre scripts start or when loading begins without prior pre scripts;
   * cleared after the footer console payload is emitted.
   */
  consoleAccum: BrowserConsoleAccum | null;

  /**
   * Promise for the in-flight (or just-started) navigation load, if any.
   */
  pendingLoad: Promise<BrowserNavigationState> | null;
}

/**
 * Copies optional HC script payload fields onto a guest session.
 *
 * @param session - Guest session to update.
 * @param hcScripts - Optional resolved pre/post scripts and modules.
 */
function applyHcScriptsPayload(
  session: BrowserGuestSession,
  hcScripts: BrowserHcScriptsPayload | undefined
): void {
  if (!hcScripts) {
    return;
  }
  if (hcScripts.preRequestScripts) {
    session.preRequestScripts = hcScripts.preRequestScripts.map(cloneHcScript);
  }
  if (hcScripts.postRequestScripts) {
    session.postRequestScripts = hcScripts.postRequestScripts.map(cloneHcScript);
  }
  if (hcScripts.snippetModules) {
    session.snippetModules = { ...hcScripts.snippetModules };
  }
  if (hcScripts.snippetModuleConflicts) {
    session.snippetModuleConflicts = [...hcScripts.snippetModuleConflicts];
  }
  if (hcScripts.requestDefaults) {
    applyRequestDefaults(session, hcScripts.requestDefaults);
  }
  if (hcScripts.variables) {
    session.variables = { ...hcScripts.variables };
  }
  if (typeof hcScripts.livepageId === 'string') {
    session.livepageId = hcScripts.livepageId.trim();
  }
}

/**
 * Copies request defaults onto a guest session.
 *
 * @param session - Guest session to update.
 * @param defaults - Headers, auth, and User-Agent for chrome-driven navigations.
 */
function applyRequestDefaults(
  session: BrowserGuestSession,
  defaults: BrowserRequestDefaultsPayload
): void {
  session.headers = defaults.headers.map((row) => ({ ...row }));
  session.auth = normalizeAuth(defaults.auth);
  session.userAgent = typeof defaults.userAgent === 'string' ? defaults.userAgent : '';
}

/**
 * Clones one resolved HC script payload.
 *
 * @param script - Source payload.
 * @returns Independent copy.
 */
function cloneHcScript(script: BrowserHcScriptSourcePayload): BrowserHcScriptSource {
  return {
    id: script.id,
    name: script.name,
    source: script.source
  };
}

/**
 * Manages WebContentsView guests for embedded browser tabs.
 */
export class BrowserViewManager {
  /**
   * Active guests keyed by browser tab id.
   */
  readonly #sessions = new Map<string, BrowserGuestSession>();

  /**
   * Newest completed guest downloads for this app session (capped).
   */
  #recentDownloads: BrowserDownloadEntry[] = [];

  /**
   * Electron sessions that already have a `will-download` listener attached.
   */
  readonly #downloadTrackedSessions = new WeakSet<Session>();

  /**
   * Creates a guest for a browser tab, attaches it hidden, and loads the URL.
   *
   * @param tabId - Browser tab id.
   * @param url - Initial navigation URL.
   * @param homeUrl - Home control URL.
   * @param scripts - Saved injection scripts.
   * @param hcScripts - Optional resolved pre/post scripts and snippet modules.
   */
  create(
    tabId: string,
    url: string,
    homeUrl: string,
    scripts: BrowserInjectionScriptPayload[],
    hcScripts?: BrowserHcScriptsPayload
  ): void {
    this.destroy(tabId);

    const window = getRegisteredMainWindow();
    if (!window || window.isDestroyed()) {
      throw new Error('Main window is not available for browser guest creation.');
    }

    const initialUrl = isAllowedBrowserUrl(url) ? url : 'about:blank';
    const resolvedHome = isAllowedBrowserUrl(homeUrl) ? homeUrl : 'about:blank';

    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        partition: `persist:browser-${tabId}`
      }
    });

    const session: BrowserGuestSession = {
      view,
      homeUrl: resolvedHome,
      scripts: scripts as BrowserInjectionScript[],
      preRequestScripts: [],
      postRequestScripts: [],
      snippetModules: {},
      snippetModuleConflicts: [],
      variables: {},
      headers: [],
      auth: defaultAuth(),
      userAgent: '',
      visible: false,
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      faviconDataUrl: null,
      hasCertificateError: false,
      faviconGeneration: 0,
      scriptData: {},
      livepageId: '',
      consoleAccum: null,
      pendingLoad: null
    };
    applyHcScriptsPayload(session, hcScripts);
    this.#sessions.set(tabId, session);

    window.contentView.addChildView(view);
    view.setVisible(false);
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

    this.#attachGuestGuards(tabId, view);
    this.#attachGuestShortcutDispatch(view);
    this.#attachNavigationEvents(tabId, view);
    this.#attachInjectionHooks(tabId, view);
    this.#attachGuestContextMenu(tabId, view);
    this.#attachDownloadTracking(view);

    session.pendingLoad = this.#trackPendingLoad(
      tabId,
      this.#navigateWithPreScripts(tabId, initialUrl)
    );
  }

  /**
   * Force-destroys and detaches the guest for a browser tab.
   *
   * Skips page `beforeunload` handlers so cleanup, recreate, and shutdown never hang.
   * User-initiated tab close should use {@link requestClose} instead.
   *
   * @param tabId - Browser tab id.
   */
  destroy(tabId: string): void {
    const session = this.#sessions.get(tabId);
    if (!session) {
      return;
    }
    this.#sessions.delete(tabId);
    this.#detachGuestView(session);

    try {
      if (!session.view.webContents.isDestroyed()) {
        // Force close: omit waitForBeforeUnload so pages cannot block teardown.
        session.view.webContents.close();
      }
    } catch {
      // Guest may already be gone.
    }
  }

  /**
   * Returns the newest completed browser downloads for this app session.
   *
   * @returns Copy of the recent-downloads list (newest first, up to 5).
   */
  listRecentDownloads(): BrowserDownloadEntry[] {
    return this.#recentDownloads.map((entry) => ({ ...entry }));
  }

  /**
   * Records a completed file (for example a live-page screenshot) into the recent-downloads list.
   *
   * @param filePath - Absolute path of the saved file.
   */
  recordRecentDownload(filePath: string): void {
    const trimmed = filePath.trim();
    if (!trimmed) {
      return;
    }
    let sizeBytes = 0;
    try {
      sizeBytes = statSync(trimmed).size;
    } catch {
      sizeBytes = 0;
    }
    const entry: BrowserDownloadEntry = {
      id: randomUUID(),
      fileName: basename(trimmed) || 'download',
      filePath: trimmed,
      sizeBytes,
      completedAt: Date.now(),
      status: 'completed'
    };
    this.#recentDownloads = prependRecentDownload(this.#recentDownloads, entry);
    this.#broadcastRecentDownloads(true);
  }

  /**
   * Closes a browser guest for a user-initiated tab close, honoring page leave prompts.
   *
   * Hides the guest, then closes with `waitForBeforeUnload`. When the page fires
   * `will-prevent-unload`, shows a Leave / Stay dialog. Leave forces unload; Stay
   * aborts and restores visibility. Resolves true only when the guest is destroyed.
   *
   * @param tabId - Browser tab id.
   * @returns True when the guest closed (or was already gone); false when the user stayed.
   */
  async requestClose(tabId: string): Promise<boolean> {
    const session = this.#sessions.get(tabId);
    if (!session) {
      return true;
    }

    const webContents = session.view.webContents;
    if (webContents.isDestroyed()) {
      this.#sessions.delete(tabId);
      this.#detachGuestView(session);
      return true;
    }

    const wasVisible = session.visible;
    this.setVisible(tabId, false);

    return await new Promise<boolean>((resolve) => {
      let settled = false;

      /**
       * Removes one-shot unload listeners.
       */
      const cleanupListeners = (): void => {
        webContents.removeListener('will-prevent-unload', onPreventUnload);
        webContents.removeListener('destroyed', onDestroyed);
      };

      /**
       * Settles the close attempt once, cleaning up the session when closed.
       *
       * @param closed - Whether the guest unloaded successfully.
       */
      const finish = (closed: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        cleanupListeners();

        if (closed) {
          if (this.#sessions.get(tabId) === session) {
            this.#sessions.delete(tabId);
            this.#detachGuestView(session);
          }
          resolve(true);
          return;
        }

        if (this.#sessions.get(tabId) === session && wasVisible) {
          this.setVisible(tabId, true);
        }
        resolve(false);
      };

      /**
       * Shows Leave / Stay when the page's beforeunload handler tries to cancel unload.
       *
       * @param event - Electron will-prevent-unload event.
       */
      const onPreventUnload = (event: { preventDefault: () => void }): void => {
        const window = getRegisteredMainWindow();
        const messageBoxOptions = {
          type: 'question' as const,
          buttons: ['Leave', 'Stay'],
          title: 'Do you want to leave this site?',
          message: 'Changes you made may not be saved.',
          detail: 'This page is asking you to confirm that you want to leave.',
          defaultId: 0,
          cancelId: 1
        };
        const choice =
          window && !window.isDestroyed()
            ? dialog.showMessageBoxSync(window, messageBoxOptions)
            : dialog.showMessageBoxSync(messageBoxOptions);

        if (isLeaveBrowserUnloadChoice(choice)) {
          // Ignore the page's beforeunload cancellation so the guest can unload.
          event.preventDefault();
          return;
        }
        finish(false);
      };

      /**
       * Completes a successful close once webContents is destroyed.
       */
      const onDestroyed = (): void => {
        finish(true);
      };

      webContents.once('will-prevent-unload', onPreventUnload);
      webContents.once('destroyed', onDestroyed);

      try {
        webContents.close({ waitForBeforeUnload: true });
      } catch {
        finish(true);
      }
    });
  }

  /**
   * Detaches a guest view from the main window content view when still attached.
   *
   * @param session - Guest session whose view should be removed.
   */
  #detachGuestView(session: BrowserGuestSession): void {
    const window = getRegisteredMainWindow();
    try {
      if (window && !window.isDestroyed()) {
        window.contentView.removeChildView(session.view);
      }
    } catch {
      // View may already be detached.
    }
  }

  /**
   * Updates guest bounds in window content coordinates.
   *
   * @param tabId - Browser tab id.
   * @param bounds - Rectangle for the visible guest.
   */
  setBounds(tabId: string, bounds: BrowserViewBounds): void {
    const session = this.#sessions.get(tabId);
    if (!session) {
      return;
    }
    session.bounds = {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.max(0, Math.round(bounds.width)),
      height: Math.max(0, Math.round(bounds.height))
    };
    if (session.visible) {
      session.view.setBounds(session.bounds);
    }
  }

  /**
   * Shows or hides a browser guest.
   *
   * @param tabId - Browser tab id.
   * @param visible - Whether the guest should paint on screen.
   */
  setVisible(tabId: string, visible: boolean): void {
    const session = this.#sessions.get(tabId);
    if (!session) {
      return;
    }
    session.visible = visible;
    if (visible) {
      session.view.setVisible(true);
      session.view.setBounds(session.bounds);
      return;
    }
    // Prefer View.setVisible so Linux compositing does not keep a zero-size child on top.
    session.view.setVisible(false);
    session.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  }

  /**
   * Hides every browser guest (for example when a non-browser tab is active).
   */
  hideAll(): void {
    for (const tabId of this.#sessions.keys()) {
      this.setVisible(tabId, false);
    }
  }

  /**
   * Navigates a guest to an allowed URL after running pre-request scripts.
   *
   * @param tabId - Browser tab id.
   * @param url - Target URL.
   */
  async loadURL(tabId: string, url: string): Promise<void> {
    const session = this.#sessions.get(tabId);
    const navigation = this.#navigateWithPreScripts(tabId, url);
    if (session) {
      session.pendingLoad = this.#trackPendingLoad(tabId, navigation);
    }
    await navigation;
  }

  /**
   * Goes back in guest history when possible, running pre scripts first.
   *
   * @param tabId - Browser tab id.
   */
  async goBack(tabId: string): Promise<void> {
    const session = this.#sessions.get(tabId);
    if (!session || !session.view.webContents.navigationHistory.canGoBack()) {
      return;
    }
    const entries = session.view.webContents.navigationHistory.getAllEntries();
    const activeIndex = session.view.webContents.navigationHistory.getActiveIndex();
    const previous = entries[activeIndex - 1];
    const previousUrl =
      previous && typeof previous.url === 'string'
        ? previous.url
        : session.view.webContents.getURL();
    await this.#runPreScripts(tabId, previousUrl || 'about:blank');
    if (!this.#sessions.has(tabId)) {
      return;
    }
    session.view.webContents.navigationHistory.goBack();
  }

  /**
   * Goes forward in guest history when possible, running pre scripts first.
   *
   * @param tabId - Browser tab id.
   */
  async goForward(tabId: string): Promise<void> {
    const session = this.#sessions.get(tabId);
    if (!session || !session.view.webContents.navigationHistory.canGoForward()) {
      return;
    }
    const entries = session.view.webContents.navigationHistory.getAllEntries();
    const activeIndex = session.view.webContents.navigationHistory.getActiveIndex();
    const next = entries[activeIndex + 1];
    const nextUrl =
      next && typeof next.url === 'string' ? next.url : session.view.webContents.getURL();
    await this.#runPreScripts(tabId, nextUrl || 'about:blank');
    if (!this.#sessions.has(tabId)) {
      return;
    }
    session.view.webContents.navigationHistory.goForward();
  }

  /**
   * Reloads the current guest page via chrome-driven navigation so request defaults apply.
   *
   * @param tabId - Browser tab id.
   */
  async reload(tabId: string): Promise<void> {
    const session = this.#sessions.get(tabId);
    if (!session) {
      return;
    }
    const currentUrl = session.view.webContents.getURL();
    const target = isAllowedBrowserUrl(currentUrl) ? currentUrl : session.homeUrl;
    await this.#navigateWithPreScripts(tabId, target || 'about:blank');
  }

  /**
   * Navigates the guest to its home URL after running pre-request scripts.
   *
   * @param tabId - Browser tab id.
   */
  async goHome(tabId: string): Promise<void> {
    const session = this.#sessions.get(tabId);
    if (!session) {
      return;
    }
    await this.#navigateWithPreScripts(tabId, session.homeUrl);
  }

  /**
   * Replaces saved injection and optional pre/post scripts for a guest.
   *
   * @param tabId - Browser tab id.
   * @param scripts - Applied injection script set.
   * @param hcScripts - Optional resolved pre/post scripts and snippet modules.
   */
  setScripts(
    tabId: string,
    scripts: BrowserInjectionScriptPayload[],
    hcScripts?: BrowserHcScriptsPayload
  ): void {
    const session = this.#sessions.get(tabId);
    if (!session) {
      return;
    }
    session.scripts = scripts as BrowserInjectionScript[];
    applyHcScriptsPayload(session, hcScripts);
  }

  /**
   * Updates the home URL for a guest.
   *
   * @param tabId - Browser tab id.
   * @param homeUrl - Allowed home URL.
   */
  setHomeUrl(tabId: string, homeUrl: string): void {
    const session = this.#sessions.get(tabId);
    if (!session || !isAllowedBrowserUrl(homeUrl)) {
      return;
    }
    session.homeUrl = homeUrl;
  }

  /**
   * Runs JavaScript in the guest page main world and returns the result.
   *
   * @param tabId - Browser tab id.
   * @param code - JavaScript source to evaluate.
   * @returns Result of the evaluation (JSON-serializable values preferred).
   * @throws When no guest exists or the webContents is destroyed.
   */
  async executeJavaScript(tabId: string, code: string): Promise<unknown> {
    const webContents = this.#requireLiveWebContents(tabId);
    return webContents.executeJavaScript(code, true);
  }

  /**
   * Inserts a CSS stylesheet into the guest page via Electron `insertCSS`.
   *
   * @param tabId - Browser tab id.
   * @param css - Stylesheet source.
   * @returns Key returned by Electron that can later identify the insertion.
   * @throws When no guest exists or the webContents is destroyed.
   */
  async insertCSS(tabId: string, css: string): Promise<string> {
    const webContents = this.#requireLiveWebContents(tabId);
    return webContents.insertCSS(css);
  }

  /**
   * Captures a PNG screenshot of the guest viewport, or the full scrollable page.
   *
   * Viewport mode uses a single Electron `webContents.capturePage()`. Full-page
   * mode scrolls in viewport-sized steps, captures each tile, stitches with jimp,
   * then restores the original scroll position. Pages taller than the height/tile
   * caps are truncated from the top rather than rejected.
   *
   * @param tabId - Browser tab id.
   * @param options - Optional `{ fullPage }` (default false).
   * @returns PNG data URL, base64 payload, and optional truncation flag.
   * @throws When no guest exists or the webContents is destroyed.
   */
  async capturePage(
    tabId: string,
    options?: { fullPage?: boolean }
  ): Promise<{ dataUrl: string; pngBase64: string; truncated?: boolean }> {
    if (options?.fullPage === true) {
      return this.#captureFullPage(tabId);
    }
    return this.#captureViewport(tabId);
  }

  /**
   * Captures the currently visible guest viewport as PNG.
   *
   * @param tabId - Browser tab id.
   * @returns PNG data URL and base64 payload.
   */
  async #captureViewport(
    tabId: string
  ): Promise<{ dataUrl: string; pngBase64: string; truncated?: boolean }> {
    const webContents = this.#requireLiveWebContents(tabId);
    const image = await webContents.capturePage();
    const png = image.toPNG();
    const pngBase64 = png.toString('base64');
    return {
      dataUrl: `data:image/png;base64,${pngBase64}`,
      pngBase64
    };
  }

  /**
   * Scrolls the guest page in viewport steps, captures tiles, and stitches a full-page PNG.
   *
   * Tall pages are capped at the configured height/tile limits;
   * the capture starts at the top of the document.
   *
   * @param tabId - Browser tab id.
   * @returns Stitched PNG data URL, base64 payload, and whether height was truncated.
   */
  async #captureFullPage(
    tabId: string
  ): Promise<{ dataUrl: string; pngBase64: string; truncated?: boolean }> {
    const webContents = this.#requireLiveWebContents(tabId);
    const metrics = (await webContents.executeJavaScript(
      `({
        scrollY: window.scrollY || window.pageYOffset || 0,
        scrollHeight: Math.max(
          document.documentElement.scrollHeight || 0,
          document.body ? document.body.scrollHeight : 0,
          document.documentElement.clientHeight || 0
        ),
        innerHeight: window.innerHeight || document.documentElement.clientHeight || 0
      })`,
      true
    )) as { scrollY: number; scrollHeight: number; innerHeight: number };

    const viewportHeight = Math.max(1, Math.floor(Number(metrics.innerHeight) || 0));
    const pageHeight = Math.max(viewportHeight, Math.floor(Number(metrics.scrollHeight) || 0));
    const originalScrollY = Number(metrics.scrollY) || 0;
    const { captureHeight, tileCount, truncated } = planFullPageCapture(pageHeight, viewportHeight);

    const tiles: Buffer[] = [];
    try {
      for (let index = 0; index < tileCount; index += 1) {
        const targetY = index * viewportHeight;
        if (targetY >= captureHeight) {
          break;
        }
        await webContents.executeJavaScript(`window.scrollTo(0, ${targetY})`, true);
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 75);
        });
        const image = await webContents.capturePage();
        let png = image.toPNG();
        const sliceHeight = Math.min(viewportHeight, captureHeight - targetY);
        if (sliceHeight < viewportHeight) {
          png = await cropPngToHeight(png, sliceHeight);
        }
        tiles.push(png);
      }
    } finally {
      try {
        if (!webContents.isDestroyed()) {
          await webContents.executeJavaScript(`window.scrollTo(0, ${originalScrollY})`, true);
        }
      } catch {
        // Best-effort scroll restore after capture failures.
      }
    }

    const stitched = await stitchPngBuffers(tiles);
    const pngBase64 = stitched.toString('base64');
    return {
      dataUrl: `data:image/png;base64,${pngBase64}`,
      pngBase64,
      truncated: truncated || undefined
    };
  }

  /**
   * Queries the live guest DOM with a CSS selector and returns capped element summaries.
   *
   * @param tabId - Browser tab id.
   * @param options - Selector and result limits.
   * @returns Query result from the page.
   * @throws When no guest exists, the webContents is destroyed, or the page returns a bad shape.
   */
  async querySelector(
    tabId: string,
    options: BrowserDomQueryOptions
  ): Promise<BrowserDomQueryResult> {
    const raw = await this.executeJavaScript(tabId, buildBrowserDomQueryScript(options));
    if (!raw || typeof raw !== 'object') {
      throw new Error('Browser DOM query returned an unexpected result.');
    }
    const result = raw as BrowserDomQueryResult & { error?: string };
    if (typeof result.error === 'string' && result.error) {
      throw new Error(result.error);
    }
    return {
      selector: typeof result.selector === 'string' ? result.selector : options.selector,
      matchCount: typeof result.matchCount === 'number' ? result.matchCount : 0,
      elements: Array.isArray(result.elements) ? result.elements : []
    };
  }

  /**
   * Waits until the guest finishes loading, then returns a navigation snapshot.
   *
   * Resolves immediately when the guest is not currently loading. Rejects on
   * main-frame load failure or timeout.
   *
   * @param tabId - Browser tab id.
   * @param timeoutMs - Maximum wait before rejecting (defaults to 30s).
   * @returns Navigation state after load settles.
   * @throws When no guest exists, load fails, or the wait times out.
   */
  async waitForLoad(
    tabId: string,
    timeoutMs: number = DEFAULT_WAIT_FOR_LOAD_MS
  ): Promise<BrowserNavigationState> {
    const session = this.#sessions.get(tabId);
    if (!session) {
      throw new Error(`No browser guest for tab "${tabId}".`);
    }

    if (session.pendingLoad) {
      const timeout =
        typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0
          ? timeoutMs
          : DEFAULT_WAIT_FOR_LOAD_MS;
      return await Promise.race([
        session.pendingLoad,
        new Promise<BrowserNavigationState>((_resolve, reject) => {
          setTimeout(() => {
            reject(new Error(`Timed out waiting for page load after ${timeout}ms.`));
          }, timeout);
        })
      ]);
    }

    const webContents = this.#requireLiveWebContents(tabId);
    if (!webContents.isLoading()) {
      return this.#snapshotNavigationState(tabId);
    }

    const timeout =
      typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0
        ? timeoutMs
        : DEFAULT_WAIT_FOR_LOAD_MS;

    return new Promise<BrowserNavigationState>((resolve, reject) => {
      let settled = false;

      /**
       * Clears listeners/timer and settles the promise at most once.
       *
       * @param action - Resolve or reject callback.
       */
      const settle = (action: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        webContents.removeListener('did-finish-load', onFinish);
        webContents.removeListener('did-fail-load', onFail);
        action();
      };

      /**
       * Resolves with the current navigation snapshot after a successful load.
       */
      const onFinish = (): void => {
        settle(() => {
          try {
            resolve(this.#snapshotNavigationState(tabId));
          } catch (error: unknown) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      };

      /**
       * Rejects when the main frame fails to load (ignores subframe / aborted).
       *
       * @param _event - Electron event.
       * @param errorCode - Chromium net error code.
       * @param errorDescription - Human-readable error.
       * @param _validatedURL - Failed URL.
       * @param isMainFrame - Whether the failure is for the main frame.
       */
      const onFail = (
        _event: Electron.Event,
        errorCode: number,
        errorDescription: string,
        _validatedURL: string,
        isMainFrame: boolean
      ): void => {
        if (!isMainFrame) {
          return;
        }
        // ERR_ABORTED (-3) often fires for superseded navigations; keep waiting.
        if (errorCode === -3) {
          return;
        }
        settle(() => {
          reject(
            new Error(
              errorDescription?.trim()
                ? `Page load failed: ${errorDescription}`
                : `Page load failed (error ${errorCode}).`
            )
          );
        });
      };

      const timer = setTimeout(() => {
        settle(() => {
          reject(new Error(`Timed out waiting for page load after ${timeout}ms.`));
        });
      }, timeout);

      webContents.on('did-finish-load', onFinish);
      webContents.on('did-fail-load', onFail);

      // Race: load finished between isLoading() check and listener attach.
      if (!webContents.isLoading()) {
        onFinish();
      }
    });
  }

  /**
   * Tracks a navigation promise on the guest session for {@link waitForLoad}.
   *
   * @param tabId - Browser tab id.
   * @param navigation - In-flight navigation work (pre scripts + loadURL).
   * @returns Promise that resolves to a navigation snapshot when load settles.
   */
  #trackPendingLoad(tabId: string, navigation: Promise<void>): Promise<BrowserNavigationState> {
    const pending = navigation
      .then(() => this.#snapshotNavigationState(tabId))
      .finally(() => {
        const session = this.#sessions.get(tabId);
        if (session && session.pendingLoad === pending) {
          session.pendingLoad = null;
        }
      });
    return pending;
  }

  /**
   * Destroys all guests (window close / shutdown).
   */
  destroyAll(): void {
    for (const tabId of [...this.#sessions.keys()]) {
      this.destroy(tabId);
    }
  }

  /**
   * Returns a live webContents for a guest, or throws when missing/destroyed.
   *
   * @param tabId - Browser tab id.
   * @returns Guest webContents.
   * @throws When the guest session is missing or destroyed.
   */
  #requireLiveWebContents(tabId: string): Electron.WebContents {
    const session = this.#sessions.get(tabId);
    if (!session) {
      throw new Error(`No browser guest for tab "${tabId}".`);
    }
    const { webContents } = session.view;
    if (webContents.isDestroyed()) {
      throw new Error(`Browser guest for tab "${tabId}" is destroyed.`);
    }
    return webContents;
  }

  /**
   * Builds a navigation snapshot for IPC / AI tools from the current guest state.
   *
   * @param tabId - Browser tab id.
   * @returns Navigation state payload.
   * @throws When the guest session is missing.
   */
  #snapshotNavigationState(tabId: string): BrowserNavigationState {
    const session = this.#sessions.get(tabId);
    if (!session) {
      throw new Error(`No browser guest for tab "${tabId}".`);
    }
    const { webContents } = session.view;
    const url = webContents.isDestroyed() ? 'about:blank' : webContents.getURL() || 'about:blank';
    return {
      tabId,
      url,
      title: webContents.isDestroyed() ? 'Browser' : webContents.getTitle() || 'Browser',
      canGoBack: webContents.isDestroyed() ? false : webContents.navigationHistory.canGoBack(),
      canGoForward: webContents.isDestroyed()
        ? false
        : webContents.navigationHistory.canGoForward(),
      faviconDataUrl: session.faviconDataUrl,
      securityState: resolveBrowserSecurityState(url, session.hasCertificateError)
    };
  }

  /**
   * Attaches navigation and popup guards to a guest webContents.
   *
   * @param tabId - Browser tab id (for logging).
   * @param view - Guest view.
   */
  #attachGuestGuards(tabId: string, view: WebContentsView): void {
    const webContents = view.webContents;

    webContents.setWindowOpenHandler((details) => {
      if (isAllowedBrowserUrl(details.url)) {
        const window = getRegisteredMainWindow();
        if (window && !window.isDestroyed()) {
          const request: BrowserOpenTabRequest = {
            url: details.url,
            sourceTabId: tabId,
            activate: details.disposition !== 'background-tab'
          };
          window.webContents.send('browser:open-tab', request);
        }
      } else if (isAllowedExternalUrl(details.url)) {
        void shell.openExternal(details.url);
      } else {
        logVerbose('Blocked browser window.open', { tabId, url: details.url });
      }
      return { action: 'deny' };
    });

    webContents.on('will-navigate', (event, url) => {
      if (!isAllowedBrowserUrl(url)) {
        logVerbose('Blocked browser will-navigate', { tabId, url });
        event.preventDefault();
      }
    });

    webContents.on('will-redirect', (event, url) => {
      if (!isAllowedBrowserUrl(url)) {
        logVerbose('Blocked browser will-redirect', { tabId, url });
        event.preventDefault();
      }
    });
  }

  /**
   * Attaches the guest right-click menu (Back / Forward / Home / image actions /
   * View Source / Copy to chat) to a browser tab.
   *
   * Inspect Element is included by the menu helper when developer tooling is enabled.
   * Open image in tab / Save image appear when the click targets an image element.
   * Copy to chat notifies the renderer with the click coordinates for an
   * `@webpage.<tabId>#x.y` chat pointer.
   *
   * @param tabId - Browser tab id whose navigation methods handle menu actions.
   * @param view - Guest view that receives right-clicks.
   */
  #attachGuestContextMenu(tabId: string, view: WebContentsView): void {
    attachBrowserGuestContextMenu(view, getRegisteredMainWindow, {
      onBack: () => {
        void this.goBack(tabId);
      },
      onForward: () => {
        void this.goForward(tabId);
      },
      onHome: () => {
        void this.goHome(tabId);
      },
      onViewSource: () => {
        this.#openViewSourceTab(tabId, view);
      },
      onCopyToChat: (x, y) => {
        const window = getRegisteredMainWindow();
        if (!window || window.isDestroyed()) {
          return;
        }
        window.webContents.send('browser:copy-to-chat', { tabId, x, y });
      },
      onOpenImageInTab: (srcURL) => {
        void this.#openGuestImageInTab(view, srcURL);
      },
      onSaveImage: (srcURL) => {
        void this.#saveGuestImage(view, srcURL);
      }
    });
  }

  /**
   * Resolves a guest image `srcURL` into an Image View open payload.
   *
   * Http(s) URLs are passed through. Data URLs are used as-is. Blob URLs are
   * fetched inside the guest and converted to a data URL because they are not
   * valid outside that document.
   *
   * @param view - Guest view that owns the image source.
   * @param srcURL - Image source from the context-menu event.
   * @returns Payload for `browser:open-image-view`, or null when unsupported.
   * @throws When blob resolution fails or the resolved value is not a data URL.
   */
  async #resolveGuestImageOpenPayload(
    view: WebContentsView,
    srcURL: string
  ): Promise<BrowserOpenImageViewPayload | null> {
    const trimmed = srcURL.trim();
    const kind = classifyBrowserGuestImageSrc(trimmed);
    const fileName = deriveImageFileNameFromSrcUrl(trimmed);

    if (kind === 'http') {
      return { url: trimmed, fileName };
    }

    if (kind === 'data') {
      return { dataUrl: trimmed, fileName };
    }

    if (kind === 'blob') {
      if (view.webContents.isDestroyed()) {
        throw new Error('Browser guest is no longer available.');
      }
      const result: unknown = await view.webContents.executeJavaScript(
        buildBlobSrcToDataUrlScript(trimmed),
        true
      );
      if (typeof result !== 'string' || !result.startsWith('data:')) {
        throw new Error('Failed to resolve blob image as a data URL.');
      }
      return { dataUrl: result, fileName };
    }

    return null;
  }

  /**
   * Opens a right-clicked guest image in a HarborClient Image View tab.
   *
   * @param view - Guest view that owns the image source.
   * @param srcURL - Image source from the context-menu event.
   */
  async #openGuestImageInTab(view: WebContentsView, srcURL: string): Promise<void> {
    try {
      const payload = await this.#resolveGuestImageOpenPayload(view, srcURL);
      if (!payload) {
        dialog.showErrorBox('Open image', 'This image source cannot be opened in a tab.');
        return;
      }
      const window = getRegisteredMainWindow();
      if (!window || window.isDestroyed()) {
        return;
      }
      window.webContents.send('browser:open-image-view', payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      dialog.showErrorBox('Open image', message);
    }
  }

  /**
   * Saves a right-clicked guest image via the native save dialog.
   *
   * Successful saves are recorded in the recent browser downloads list.
   *
   * @param view - Guest view that owns the image source.
   * @param srcURL - Image source from the context-menu event.
   */
  async #saveGuestImage(view: WebContentsView, srcURL: string): Promise<void> {
    try {
      const payload = await this.#resolveGuestImageOpenPayload(view, srcURL);
      if (!payload) {
        dialog.showErrorBox('Save image', 'This image source cannot be saved.');
        return;
      }

      const result =
        'url' in payload
          ? await saveImageWithSaveDialog({
              url: payload.url,
              defaultFileName: payload.fileName
            })
          : await saveImageWithSaveDialog({
              dataUrl: payload.dataUrl,
              defaultFileName: payload.fileName
            });

      if (!result.canceled && result.path) {
        this.recordRecentDownload(result.path);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      dialog.showErrorBox('Save image', message);
    }
  }

  /**
   * Records Chromium downloads from a guest session into the recent-downloads list.
   *
   * Attaches a single `will-download` listener per Electron session so recreating a tab
   * with the same partition does not stack handlers. Leaves Chromium's save dialog alone
   * (does not call `setSavePath`). Broadcasts with `autoOpen` when a download starts or
   * completes so the renderer can open the downloads menu.
   *
   * @param view - Guest view whose session emits download events.
   */
  #attachDownloadTracking(view: WebContentsView): void {
    const ses = view.webContents.session;
    if (this.#downloadTrackedSessions.has(ses)) {
      return;
    }
    this.#downloadTrackedSessions.add(ses);

    ses.on('will-download', (_event, item) => {
      const id = randomUUID();
      const filePath = item.getSavePath();
      const fileName = item.getFilename() || filePath.split(/[/\\]/).pop() || 'download';
      const totalBytes = item.getTotalBytes();
      const started: BrowserDownloadEntry = {
        id,
        fileName,
        filePath,
        sizeBytes: totalBytes > 0 ? totalBytes : 0,
        completedAt: 0,
        status: 'downloading'
      };
      this.#recentDownloads = prependRecentDownload(this.#recentDownloads, started);
      this.#broadcastRecentDownloads(true);

      item.once('done', (_doneEvent, state) => {
        if (state !== 'completed') {
          this.#recentDownloads = removeRecentDownload(this.#recentDownloads, id);
          this.#broadcastRecentDownloads(false);
          return;
        }
        const completedPath = item.getSavePath() || filePath;
        const completedName = item.getFilename() || completedPath.split(/[/\\]/).pop() || fileName;
        let sizeBytes = item.getTotalBytes();
        if (sizeBytes <= 0 && completedPath) {
          try {
            sizeBytes = statSync(completedPath).size;
          } catch {
            sizeBytes = 0;
          }
        }
        const completed: BrowserDownloadEntry = {
          id,
          fileName: completedName,
          filePath: completedPath,
          sizeBytes,
          completedAt: Date.now(),
          status: 'completed'
        };
        if (completedPath.trim()) {
          try {
            grantFilePathAccess(completedPath);
          } catch {
            // Download path may be unset until Chromium finalizes the save dialog.
          }
        }
        this.#recentDownloads = updateRecentDownload(this.#recentDownloads, completed);
        this.#broadcastRecentDownloads(true);
      });
    });
  }

  /**
   * Pushes the current recent-downloads list to the main window renderer.
   *
   * @param autoOpen - When true, the renderer should open the downloads menu.
   */
  #broadcastRecentDownloads(autoOpen: boolean): void {
    const window = getRegisteredMainWindow();
    if (!window || window.isDestroyed()) {
      return;
    }
    window.webContents.send('browser:downloads-changed', {
      downloads: this.listRecentDownloads(),
      autoOpen
    });
  }

  /**
   * Opens a new browser tab showing Chromium view-source for the guest's current URL.
   *
   * @param tabId - Source browser tab id (for home/script inheritance).
   * @param view - Guest whose current URL is wrapped.
   */
  #openViewSourceTab(tabId: string, view: WebContentsView): void {
    const { webContents } = view;
    if (webContents.isDestroyed()) {
      return;
    }
    const viewSourceUrl = toViewSourceUrl(webContents.getURL());
    if (!viewSourceUrl || !isAllowedBrowserUrl(viewSourceUrl)) {
      return;
    }
    const window = getRegisteredMainWindow();
    if (!window || window.isDestroyed()) {
      return;
    }
    const request: BrowserOpenTabRequest = {
      url: viewSourceUrl,
      sourceTabId: tabId,
      activate: true
    };
    window.webContents.send('browser:open-tab', request);
  }

  /**
   * Forwards HarborClient action shortcuts (e.g. Ctrl+S Save) from a focused
   * guest to the main renderer, preventing Chromium from handling them (Save Page).
   *
   * @param view - Guest view whose webContents receives keyboard input.
   */
  #attachGuestShortcutDispatch(view: WebContentsView): void {
    view.webContents.on('before-input-event', (event, input) => {
      const window = getRegisteredMainWindow();
      if (!window || window.isDestroyed()) {
        return;
      }
      if (tryDispatchActionShortcut(window, input)) {
        event.preventDefault();
      }
    });
  }

  /**
   * Forwards URL/title/history/favicon state to the renderer.
   *
   * @param tabId - Browser tab id.
   * @param view - Guest view.
   */
  #attachNavigationEvents(tabId: string, view: WebContentsView): void {
    const webContents = view.webContents;

    /**
     * Emits the current navigation snapshot to the main window renderer.
     */
    const emitState = (): void => {
      const session = this.#sessions.get(tabId);
      if (!session) {
        return;
      }
      const window = getRegisteredMainWindow();
      if (!window || window.isDestroyed()) {
        return;
      }
      const url = webContents.getURL() || 'about:blank';
      const state: BrowserNavigationState = {
        tabId,
        url,
        title: webContents.getTitle() || 'Browser',
        canGoBack: webContents.navigationHistory.canGoBack(),
        canGoForward: webContents.navigationHistory.canGoForward(),
        faviconDataUrl: session.faviconDataUrl,
        securityState: resolveBrowserSecurityState(url, session.hasCertificateError)
      };
      window.webContents.send('browser:navigation', state);
    };

    /**
     * Clears the session favicon and notifies the renderer (new document).
     */
    const clearFavicon = (): void => {
      const session = this.#sessions.get(tabId);
      if (!session) {
        return;
      }
      session.faviconGeneration += 1;
      session.faviconDataUrl = null;
      emitState();
    };

    webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
      if (!isMainFrame || isInPlace) {
        return;
      }
      const session = this.#sessions.get(tabId);
      if (!session) {
        return;
      }
      session.hasCertificateError = false;
    });
    /**
     * Allows TLS errors only for origins of currently running HTTPS live
     * servers (self-signed / private CA). Still sets `hasCertificateError` so
     * the lock icon stays `invalid-cert` — we do not globally disable verification.
     */
    webContents.on('certificate-error', (event, url, _error, _certificate, callback) => {
      event.preventDefault();
      const session = this.#sessions.get(tabId);
      const runningOrigins = listRunningLiveServers().map((server) => server.origin);
      const allow = shouldAllowLiveServerCertificateError(url, runningOrigins);
      if (session) {
        // Prefer showing untrusted-cert chrome even when we allow the load for
        // a matching live-server origin (knowingly browsing self-signed TLS).
        session.hasCertificateError = true;
      }
      callback(allow);
      emitState();
    });
    webContents.on(
      'did-fail-load',
      (_event, errorCode, _errorDescription, _validatedURL, isMainFrame) => {
        if (!isMainFrame || !isCertificateFailLoadError(errorCode)) {
          return;
        }
        const session = this.#sessions.get(tabId);
        if (!session) {
          return;
        }
        session.hasCertificateError = true;
        emitState();
      }
    );
    webContents.on('did-navigate', () => {
      clearFavicon();
    });
    webContents.on('did-navigate-in-page', emitState);
    webContents.on('page-title-updated', emitState);
    webContents.on('did-start-loading', () => {
      const session = this.#sessions.get(tabId);
      if (!session) {
        return;
      }
      if (!session.consoleAccum) {
        session.consoleAccum = createBrowserConsoleAccum();
      }
    });
    webContents.on('did-finish-load', () => {
      emitState();
      void this.#resolveFaviconAfterLoad(tabId);
      void this.#finishNavigationConsole(tabId);
    });
    webContents.on('page-favicon-updated', (_event, favicons) => {
      void this.#resolveFaviconFromCandidates(
        tabId,
        candidatesFromChromiumFavicons(favicons, webContents.getURL() || 'about:blank')
      );
    });
  }

  /**
   * Runs pre-request scripts then loads an allowed URL (applying URL mutations from scripts).
   *
   * @param tabId - Browser tab id.
   * @param url - Requested navigation URL.
   */
  async #navigateWithPreScripts(tabId: string, url: string): Promise<void> {
    if (!isAllowedBrowserUrl(url)) {
      return;
    }
    const session = this.#sessions.get(tabId);
    if (!session) {
      return;
    }
    const navigatedUrl = await this.#runPreScripts(tabId, url);
    if (!this.#sessions.has(tabId)) {
      return;
    }
    const target = navigatedUrl && isAllowedBrowserUrl(navigatedUrl) ? navigatedUrl : url;
    try {
      const loadOptions = buildBrowserLoadURLOptions(
        session.headers,
        session.auth,
        session.userAgent
      );
      await session.view.webContents.loadURL(target, loadOptions);
    } catch (error: unknown) {
      logVerbose('browser guest loadURL failed', { tabId, url: target, error: String(error) });
    }
  }

  /**
   * Runs saved pre-request hc.* scripts for a planned navigation URL.
   *
   * @param tabId - Browser tab id.
   * @param url - Planned navigation URL.
   * @returns Possibly mutated URL from hc.request.url, or the original URL.
   */
  async #runPreScripts(tabId: string, url: string): Promise<string> {
    const session = this.#sessions.get(tabId);
    if (!session) {
      return url;
    }

    session.consoleAccum = createBrowserConsoleAccum();
    session.scriptData = {};

    if (session.preRequestScripts.length === 0) {
      return url;
    }

    let request = buildBrowserScriptRequest(url);
    let runtimeVars = { ...session.variables };

    for (const script of session.preRequestScripts) {
      const input: ScriptRunInput = {
        phase: 'pre',
        script: script.source,
        request,
        variables: runtimeVars,
        info: buildScriptRunInfo('pre', { livepageId: session.livepageId }),
        data: session.scriptData,
        snippetModules: session.snippetModules,
        snippetModuleConflicts: session.snippetModuleConflicts
      };
      try {
        const result = await runScriptInProcess(input);
        request = result.request;
        runtimeVars = applyBrowserScriptVariableResult(runtimeVars, result);
        const accum: BrowserConsoleAccum = session.consoleAccum ?? createBrowserConsoleAccum();
        session.consoleAccum = accum;
        appendBrowserScriptResult(accum, 'pre', script.id, script.name, result);
        if (result.error) {
          logVerbose('browser pre-request script failed', {
            tabId,
            scriptId: script.id,
            name: script.name,
            error: result.error
          });
        }
      } catch (error: unknown) {
        const message = String(error);
        const accum: BrowserConsoleAccum = session.consoleAccum ?? createBrowserConsoleAccum();
        session.consoleAccum = accum;
        accum.scriptErrorLines.push(`${script.name}: ${message}`);
        accum.scriptErrors.push({
          message,
          scriptName: script.name,
          scriptId: script.id,
          phase: 'pre',
          scope: 'request'
        });
        logVerbose('browser pre-request script threw', {
          tabId,
          scriptId: script.id,
          name: script.name,
          error: message
        });
      }
    }

    return request.url || url;
  }

  /**
   * Snapshots the loaded page, runs post-request scripts, and emits a footer console entry.
   *
   * @param tabId - Browser tab id.
   */
  async #finishNavigationConsole(tabId: string): Promise<void> {
    const session = this.#sessions.get(tabId);
    if (!session) {
      return;
    }
    const webContents = session.view.webContents;
    if (webContents.isDestroyed()) {
      return;
    }

    const accum: BrowserConsoleAccum = session.consoleAccum ?? createBrowserConsoleAccum();
    session.consoleAccum = accum;

    const pageUrl = webContents.getURL() || 'about:blank';
    const title = webContents.getTitle() || '';
    let html = '';
    try {
      const snapshot = (await webContents.executeJavaScript(
        `(() => {
          try {
            return document.documentElement ? document.documentElement.outerHTML : '';
          } catch (error) {
            return '';
          }
        })()`,
        true
      )) as unknown;
      if (typeof snapshot === 'string') {
        html = snapshot;
      }
    } catch (error: unknown) {
      logVerbose('browser page HTML snapshot failed', { tabId, error: String(error) });
    }

    const response: SendResult = buildBrowserPageResponseSnapshot({
      url: pageUrl,
      title,
      html
    });

    if (session.postRequestScripts.length > 0) {
      let request = buildBrowserScriptRequest(pageUrl);
      session.scriptData = {};
      let runtimeVars = { ...session.variables };

      for (const script of session.postRequestScripts) {
        const input: ScriptRunInput = {
          phase: 'post',
          script: script.source,
          request,
          response,
          variables: runtimeVars,
          info: buildScriptRunInfo('post', { livepageId: session.livepageId }),
          data: session.scriptData,
          snippetModules: session.snippetModules,
          snippetModuleConflicts: session.snippetModuleConflicts
        };
        try {
          const result = await runScriptInProcess(input);
          request = result.request;
          runtimeVars = applyBrowserScriptVariableResult(runtimeVars, result);
          appendBrowserScriptResult(accum, 'post', script.id, script.name, result);
          if (result.error) {
            logVerbose('browser post-request script failed', {
              tabId,
              scriptId: script.id,
              name: script.name,
              error: result.error
            });
          }
        } catch (error: unknown) {
          const message = String(error);
          accum.scriptErrorLines.push(`${script.name}: ${message}`);
          accum.scriptErrors.push({
            message,
            scriptName: script.name,
            scriptId: script.id,
            phase: 'post',
            scope: 'request'
          });
          logVerbose('browser post-request script threw', {
            tabId,
            scriptId: script.id,
            name: script.name,
            error: message
          });
        }
      }
    }

    session.consoleAccum = null;

    if (!shouldEmitBrowserConsoleEntry(pageUrl, title)) {
      return;
    }

    const window = getRegisteredMainWindow();
    if (!window || window.isDestroyed()) {
      return;
    }

    const payload: BrowserConsoleEntryPayload = buildBrowserConsoleEntryPayload(
      tabId,
      response,
      accum
    );
    window.webContents.send('browser:console-entry', payload);
  }

  /**
   * Resolves and applies a favicon after load when Chromium has not provided one yet.
   *
   * Scrapes `<link rel=icon>` from the document, then falls back to `/favicon.ico`.
   *
   * @param tabId - Browser tab id.
   */
  async #resolveFaviconAfterLoad(tabId: string): Promise<void> {
    const session = this.#sessions.get(tabId);
    if (!session || session.faviconDataUrl) {
      return;
    }
    const webContents = session.view.webContents;
    if (webContents.isDestroyed()) {
      return;
    }
    const pageUrl = webContents.getURL() || 'about:blank';
    if (!isFaviconEligibleUrl(pageUrl)) {
      return;
    }

    const generation = session.faviconGeneration;
    const candidates: string[] = [];

    try {
      const scraped = (await webContents.executeJavaScript(faviconScrapeScript(), true)) as
        | { href: string; rel?: string; sizes?: string }[]
        | null;
      if (Array.isArray(scraped)) {
        candidates.push(...candidatesFromScrapedLinks(scraped, pageUrl));
      }
    } catch (error: unknown) {
      logVerbose('browser favicon scrape failed', { tabId, error: String(error) });
    }

    const ico = defaultFaviconIcoUrl(pageUrl);
    if (ico && !candidates.includes(ico)) {
      candidates.push(ico);
    }

    if (this.#sessions.get(tabId)?.faviconGeneration !== generation) {
      return;
    }
    await this.#resolveFaviconFromCandidates(tabId, candidates, generation);
  }

  /**
   * Tries candidate favicon URLs (cache → fetch → data URL) and emits navigation state.
   *
   * @param tabId - Browser tab id.
   * @param candidates - Absolute http(s) or data URLs, best-first.
   * @param expectedGeneration - Optional generation that must still match the session.
   */
  async #resolveFaviconFromCandidates(
    tabId: string,
    candidates: readonly string[],
    expectedGeneration?: number
  ): Promise<void> {
    const session = this.#sessions.get(tabId);
    if (!session || session.faviconDataUrl) {
      return;
    }
    if (expectedGeneration !== undefined && session.faviconGeneration !== expectedGeneration) {
      return;
    }

    const webContents = session.view.webContents;
    if (webContents.isDestroyed()) {
      return;
    }
    const pageUrl = webContents.getURL() || 'about:blank';
    const origin = faviconCacheKeyForUrl(pageUrl);
    if (!origin) {
      return;
    }

    const generation = expectedGeneration ?? session.faviconGeneration;
    const cached = faviconCache.get(origin);
    if (cached) {
      this.#applyFavicon(tabId, cached, generation);
      return;
    }

    for (const candidate of candidates) {
      if (this.#sessions.get(tabId)?.faviconGeneration !== generation) {
        return;
      }
      if (candidate.startsWith('data:')) {
        this.#applyFavicon(tabId, candidate, generation);
        return;
      }
      const dataUrl = await this.#fetchFaviconDataUrl(candidate);
      if (!dataUrl) {
        continue;
      }
      if (this.#sessions.get(tabId)?.faviconGeneration !== generation) {
        return;
      }
      faviconCache.set(origin, dataUrl);
      this.#applyFavicon(tabId, dataUrl, generation);
      return;
    }
  }

  /**
   * Stores a resolved favicon on the session and pushes navigation state when still current.
   *
   * @param tabId - Browser tab id.
   * @param dataUrl - Favicon data URL.
   * @param generation - Generation that must still match.
   */
  #applyFavicon(tabId: string, dataUrl: string, generation: number): void {
    const session = this.#sessions.get(tabId);
    if (!session || session.faviconGeneration !== generation) {
      return;
    }
    session.faviconDataUrl = dataUrl;
    const window = getRegisteredMainWindow();
    if (!window || window.isDestroyed() || session.view.webContents.isDestroyed()) {
      return;
    }
    const webContents = session.view.webContents;
    const url = webContents.getURL() || 'about:blank';
    const state: BrowserNavigationState = {
      tabId,
      url,
      title: webContents.getTitle() || 'Browser',
      canGoBack: webContents.navigationHistory.canGoBack(),
      canGoForward: webContents.navigationHistory.canGoForward(),
      faviconDataUrl: session.faviconDataUrl,
      securityState: resolveBrowserSecurityState(url, session.hasCertificateError)
    };
    window.webContents.send('browser:navigation', state);
  }

  /**
   * Downloads a remote favicon and encodes it as a data URL when valid.
   *
   * @param url - Absolute http(s) favicon URL.
   * @returns Data URL, or null when the response is unusable.
   */
  async #fetchFaviconDataUrl(url: string): Promise<string | null> {
    try {
      const response = await net.fetch(url);
      if (!response.ok) {
        return null;
      }
      const contentType = response.headers.get('content-type') ?? undefined;
      if (!isAcceptableFaviconContentType(contentType)) {
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > FAVICON_MAX_BYTES) {
        return null;
      }
      return bytesToFaviconDataUrl(Buffer.from(arrayBuffer), contentType);
    } catch (error: unknown) {
      logVerbose('browser favicon fetch failed', { url, error: String(error) });
      return null;
    }
  }

  /**
   * Runs saved injection scripts at the configured page-load hooks.
   *
   * @param tabId - Browser tab id.
   * @param view - Guest view.
   */
  #attachInjectionHooks(tabId: string, view: WebContentsView): void {
    const webContents = view.webContents;

    /**
     * Executes enabled scripts for one lifecycle hook.
     *
     * @param runAt - Hook that just fired.
     */
    const runScripts = (runAt: BrowserScriptRunAt): void => {
      const session = this.#sessions.get(tabId);
      if (!session || webContents.isDestroyed()) {
        return;
      }
      const scripts = selectScriptsForRunAt(session.scripts, runAt);
      for (const script of scripts) {
        void webContents.executeJavaScript(script.source, true).catch((error: unknown) => {
          logVerbose('browser injection script failed', {
            tabId,
            scriptId: script.id,
            runAt,
            error: String(error)
          });
        });
      }
    };

    // document-start: earliest practical hook without a preload.
    webContents.on(
      'did-frame-navigate',
      (_event, _url, _httpResponseCode, _status, isMainFrame) => {
        if (isMainFrame) {
          runScripts('document-start');
        }
      }
    );

    webContents.on('dom-ready', () => {
      runScripts('dom-ready');
    });

    webContents.on('did-finish-load', () => {
      runScripts('did-finish-load');
    });
  }
}

let browserViewManager: BrowserViewManager | null = null;

/**
 * Returns the singleton {@link BrowserViewManager}, creating it on first use.
 *
 * @returns Shared browser view manager.
 */
export function getBrowserViewManager(): BrowserViewManager {
  if (!browserViewManager) {
    browserViewManager = new BrowserViewManager();
  }
  return browserViewManager;
}

/**
 * Clears the singleton manager (tests / window recreate).
 */
export function resetBrowserViewManagerForTests(): void {
  browserViewManager?.destroyAll();
  browserViewManager = null;
}
