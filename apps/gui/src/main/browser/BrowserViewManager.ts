import { WebContentsView, dialog, net, shell } from 'electron';
import type {
  BrowserHcScriptSourcePayload,
  BrowserHcScriptsPayload,
  BrowserInjectionScriptPayload,
  BrowserNavigationState,
  BrowserOpenTabRequest,
  BrowserViewBounds,
  ScriptRunInput,
  SendResult
} from '@harborclient/core/types';
import { isLeaveBrowserUnloadChoice } from '#/main/browser/browserUnloadPrompt';
import {
  selectScriptsForRunAt,
  type BrowserInjectionScript,
  type BrowserScriptRunAt
} from '#/browser/browserScripts';
import {
  buildBrowserPageResponseSnapshot,
  buildBrowserScriptRequest,
  type BrowserHcScriptSource
} from '#/browser/browserHcScripts';
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
import { isAllowedBrowserUrl } from '#/browser/browserUrl';
import {
  buildBrowserDomQueryScript,
  type BrowserDomQueryOptions,
  type BrowserDomQueryResult
} from '#/browser/browserDomQuery';
import { isAllowedExternalUrl } from '#/main/window/navigationSecurity';
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
   * Monotonic token bumped on each main-frame navigation to discard stale favicon work.
   */
  faviconGeneration: number;

  /**
   * Mutable object bag threaded across sequential browser scripts within one navigation.
   */
  scriptData: Record<string, unknown>;

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
      visible: false,
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      faviconDataUrl: null,
      faviconGeneration: 0,
      scriptData: {},
      pendingLoad: null
    };
    applyHcScriptsPayload(session, hcScripts);
    this.#sessions.set(tabId, session);

    window.contentView.addChildView(view);
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

    this.#attachGuestGuards(tabId, view);
    this.#attachGuestShortcutDispatch(view);
    this.#attachNavigationEvents(tabId, view);
    this.#attachInjectionHooks(tabId, view);

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
      session.view.setBounds(session.bounds);
      return;
    }
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
   * Reloads the current guest page.
   *
   * @param tabId - Browser tab id.
   */
  reload(tabId: string): void {
    const session = this.#sessions.get(tabId);
    if (!session) {
      return;
    }
    session.view.webContents.reload();
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
    return {
      tabId,
      url: webContents.isDestroyed() ? 'about:blank' : webContents.getURL() || 'about:blank',
      title: webContents.isDestroyed() ? 'Browser' : webContents.getTitle() || 'Browser',
      canGoBack: webContents.isDestroyed() ? false : webContents.navigationHistory.canGoBack(),
      canGoForward: webContents.isDestroyed()
        ? false
        : webContents.navigationHistory.canGoForward(),
      faviconDataUrl: session.faviconDataUrl
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
      const state: BrowserNavigationState = {
        tabId,
        url: webContents.getURL() || 'about:blank',
        title: webContents.getTitle() || 'Browser',
        canGoBack: webContents.navigationHistory.canGoBack(),
        canGoForward: webContents.navigationHistory.canGoForward(),
        faviconDataUrl: session.faviconDataUrl
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

    webContents.on('did-navigate', () => {
      clearFavicon();
    });
    webContents.on('did-navigate-in-page', emitState);
    webContents.on('page-title-updated', emitState);
    webContents.on('did-finish-load', () => {
      emitState();
      void this.#resolveFaviconAfterLoad(tabId);
      void this.#runPostScripts(tabId);
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
      await session.view.webContents.loadURL(target);
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
    if (!session || session.preRequestScripts.length === 0) {
      return url;
    }

    session.scriptData = {};
    let request = buildBrowserScriptRequest(url);

    for (const script of session.preRequestScripts) {
      const input: ScriptRunInput = {
        phase: 'pre',
        script: script.source,
        request,
        variables: {},
        data: session.scriptData,
        snippetModules: session.snippetModules,
        snippetModuleConflicts: session.snippetModuleConflicts
      };
      try {
        const result = await runScriptInProcess(input);
        request = result.request;
        if (result.error) {
          logVerbose('browser pre-request script failed', {
            tabId,
            scriptId: script.id,
            name: script.name,
            error: result.error
          });
        }
      } catch (error: unknown) {
        logVerbose('browser pre-request script threw', {
          tabId,
          scriptId: script.id,
          name: script.name,
          error: String(error)
        });
      }
    }

    return request.url || url;
  }

  /**
   * Reads the loaded page and runs post-request hc.* scripts with hc.response.
   *
   * @param tabId - Browser tab id.
   */
  async #runPostScripts(tabId: string): Promise<void> {
    const session = this.#sessions.get(tabId);
    if (!session || session.postRequestScripts.length === 0) {
      return;
    }
    const webContents = session.view.webContents;
    if (webContents.isDestroyed()) {
      return;
    }

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
    let request = buildBrowserScriptRequest(pageUrl);
    session.scriptData = {};

    for (const script of session.postRequestScripts) {
      const input: ScriptRunInput = {
        phase: 'post',
        script: script.source,
        request,
        response,
        variables: {},
        data: session.scriptData,
        snippetModules: session.snippetModules,
        snippetModuleConflicts: session.snippetModuleConflicts
      };
      try {
        const result = await runScriptInProcess(input);
        request = result.request;
        if (result.error) {
          logVerbose('browser post-request script failed', {
            tabId,
            scriptId: script.id,
            name: script.name,
            error: result.error
          });
        }
      } catch (error: unknown) {
        logVerbose('browser post-request script threw', {
          tabId,
          scriptId: script.id,
          name: script.name,
          error: String(error)
        });
      }
    }
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
    const state: BrowserNavigationState = {
      tabId,
      url: webContents.getURL() || 'about:blank',
      title: webContents.getTitle() || 'Browser',
      canGoBack: webContents.navigationHistory.canGoBack(),
      canGoForward: webContents.navigationHistory.canGoForward(),
      faviconDataUrl: session.faviconDataUrl
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
