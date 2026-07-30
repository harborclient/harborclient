import type { AuthConfig } from '../../auth';
import type { KeyValue } from '../common';

/**
 * Page-load points at which an embedded browser injection script may run.
 */
export type BrowserScriptRunAt = 'document-start' | 'dom-ready' | 'did-finish-load';

/**
 * One plain JavaScript injection script owned by a browser tab.
 */
export interface BrowserInjectionScriptPayload {
  /**
   * Stable id within the browser tab's script list.
   */
  id: string;

  /**
   * Display name shown in browser settings.
   */
  name: string;

  /**
   * When false, the script is skipped at injection time.
   */
  enabled: boolean;

  /**
   * Guest lifecycle hook that triggers this script.
   */
  runAt: BrowserScriptRunAt;

  /**
   * JavaScript source executed in the page main world.
   */
  source: string;
}

/**
 * One resolved pre/post hc.* script applied on browser navigation.
 */
export interface BrowserHcScriptSourcePayload {
  /**
   * Stable script id from the editor ScriptRef.
   */
  id: string;

  /**
   * Display name used in verbose logs.
   */
  name: string;

  /**
   * JavaScript source executed in the SES sandbox.
   */
  source: string;
}

/**
 * Headers, auth, and User-Agent applied to chrome-driven guest navigations.
 */
export interface BrowserRequestDefaultsPayload {
  /**
   * Header rows sent with loadURL navigations.
   */
  headers: KeyValue[];

  /**
   * Authorization config (Basic/Bearer applied on loadURL).
   */
  auth: AuthConfig;

  /**
   * User-Agent override; empty keeps Chromium default.
   */
  userAgent: string;
}

/**
 * Optional pre/post scripts and snippet modules pushed with injection scripts.
 */
export interface BrowserHcScriptsPayload {
  /**
   * Resolved pre-request scripts run before navigation.
   */
  preRequestScripts?: BrowserHcScriptSourcePayload[];

  /**
   * Resolved post-request scripts run after did-finish-load.
   */
  postRequestScripts?: BrowserHcScriptSourcePayload[];

  /**
   * Importable snippet sources for relative imports during bundling.
   */
  snippetModules?: Record<string, string>;

  /**
   * Ambiguous snippet filenames that should fail import resolution.
   */
  snippetModuleConflicts?: string[];

  /**
   * Request defaults applied on chrome-driven loadURL navigations.
   */
  requestDefaults?: BrowserRequestDefaultsPayload;
}

/**
 * Bounds of the browser guest relative to the BrowserWindow content area.
 */
export interface BrowserViewBounds {
  /**
   * Left edge in CSS pixels relative to the window content view.
   */
  x: number;

  /**
   * Top edge in CSS pixels relative to the window content view.
   */
  y: number;

  /**
   * Width in CSS pixels.
   */
  width: number;

  /**
   * Height in CSS pixels.
   */
  height: number;
}

/**
 * Navigation / title update pushed from main to the renderer for one browser tab.
 */
export interface BrowserNavigationState {
  /**
   * Browser tab id that owns the guest.
   */
  tabId: string;

  /**
   * Last committed URL.
   */
  url: string;

  /**
   * Document title from the guest.
   */
  title: string;

  /**
   * Whether history can go back.
   */
  canGoBack: boolean;

  /**
   * Whether history can go forward.
   */
  canGoForward: boolean;

  /**
   * Resolved favicon as a data URL for the tab bar, or null when cleared / unavailable.
   */
  faviconDataUrl: string | null;
}

/**
 * Request from main to open a HarborClient browser tab for a guest popup
 * (`target="_blank"` / `window.open()`).
 */
export interface BrowserOpenTabRequest {
  /**
   * Absolute URL to load in the new tab (already validated as an allowed browser URL).
   */
  url: string;

  /**
   * Browser tab id of the guest that initiated the open (for home/script inheritance).
   */
  sourceTabId: string;

  /**
   * When true, select the new tab; when false, open in the background.
   */
  activate: boolean;
}

/**
 * IPC methods for the embedded WebContentsView browser.
 */
export interface ApiBrowser {
  /**
   * Creates a WebContentsView guest for a browser tab and loads its initial URL.
   *
   * @param tabId - Browser tab id.
   * @param url - Initial URL (http, https, or about:blank).
   * @param homeUrl - URL used by the Home control.
   * @param scripts - Saved injection scripts.
   * @param hcScripts - Optional resolved pre/post scripts and snippet modules.
   */
  browserCreate: (
    tabId: string,
    url: string,
    homeUrl: string,
    scripts: BrowserInjectionScriptPayload[],
    hcScripts?: BrowserHcScriptsPayload
  ) => Promise<void>;

  /**
   * Force-destroys the WebContentsView for a closed browser tab (skips beforeunload).
   *
   * @param tabId - Browser tab id.
   */
  browserDestroy: (tabId: string) => Promise<void>;

  /**
   * Closes a browser guest for a user-initiated tab close, honoring page leave prompts.
   *
   * @param tabId - Browser tab id.
   * @returns True when the guest closed; false when the user chose to stay.
   */
  browserRequestClose: (tabId: string) => Promise<boolean>;

  /**
   * Hides every browser guest (for example while a modal must paint above the page).
   */
  browserHideAll: () => Promise<void>;

  /**
   * Updates the on-screen bounds of a browser guest.
   *
   * @param tabId - Browser tab id.
   * @param bounds - Rectangle in window content coordinates.
   */
  browserSetBounds: (tabId: string, bounds: BrowserViewBounds) => Promise<void>;

  /**
   * Shows or hides a browser guest (inactive tabs stay hidden).
   *
   * @param tabId - Browser tab id.
   * @param visible - Whether the guest should be visible.
   */
  browserSetVisible: (tabId: string, visible: boolean) => Promise<void>;

  /**
   * Navigates the guest to a URL.
   *
   * @param tabId - Browser tab id.
   * @param url - Allowed http(s) or about:blank URL.
   */
  browserLoadURL: (tabId: string, url: string) => Promise<void>;

  /**
   * Navigates back in guest history when possible.
   *
   * @param tabId - Browser tab id.
   */
  browserGoBack: (tabId: string) => Promise<void>;

  /**
   * Navigates forward in guest history when possible.
   *
   * @param tabId - Browser tab id.
   */
  browserGoForward: (tabId: string) => Promise<void>;

  /**
   * Reloads the current guest page.
   *
   * @param tabId - Browser tab id.
   */
  browserReload: (tabId: string) => Promise<void>;

  /**
   * Navigates the guest to its configured home URL.
   *
   * @param tabId - Browser tab id.
   */
  browserGoHome: (tabId: string) => Promise<void>;

  /**
   * Replaces the saved injection and optional pre/post scripts used on subsequent loads.
   *
   * @param tabId - Browser tab id.
   * @param scripts - Saved injection scripts (applied set).
   * @param hcScripts - Optional resolved pre/post scripts and snippet modules.
   */
  browserSetScripts: (
    tabId: string,
    scripts: BrowserInjectionScriptPayload[],
    hcScripts?: BrowserHcScriptsPayload
  ) => Promise<void>;

  /**
   * Updates the home URL for the Home control.
   *
   * @param tabId - Browser tab id.
   * @param homeUrl - Allowed home URL.
   */
  browserSetHomeUrl: (tabId: string, homeUrl: string) => Promise<void>;

  /**
   * Runs JavaScript in the guest page main world and returns the result.
   *
   * @param tabId - Browser tab id.
   * @param code - JavaScript source to evaluate.
   */
  browserExecuteJavaScript: (tabId: string, code: string) => Promise<unknown>;

  /**
   * Inserts a CSS stylesheet into the guest page.
   *
   * @param tabId - Browser tab id.
   * @param css - Stylesheet source.
   * @returns Electron insertion key.
   */
  browserInsertCSS: (tabId: string, css: string) => Promise<string>;

  /**
   * Queries the live guest DOM with a CSS selector.
   *
   * @param tabId - Browser tab id.
   * @param selector - CSS selector.
   * @param all - When true, return every match up to maxElements.
   * @param maxElements - Maximum elements to return.
   */
  browserQuerySelector: (
    tabId: string,
    selector: string,
    all?: boolean,
    maxElements?: number
  ) => Promise<{
    selector: string;
    matchCount: number;
    elements: Array<{
      tagName: string;
      id: string;
      className: string;
      textContent: string;
      outerHTML: string;
      attributes: Record<string, string>;
    }>;
  }>;

  /**
   * Waits until the guest finishes loading and returns a navigation snapshot.
   *
   * @param tabId - Browser tab id.
   * @param timeoutMs - Optional max wait in milliseconds.
   */
  browserWaitForLoad: (tabId: string, timeoutMs?: number) => Promise<BrowserNavigationState>;

  /**
   * Captures a PNG screenshot of the guest's visible viewport or full scrollable page.
   *
   * Full-page captures taller than the height/tile caps are truncated from the top;
   * `truncated` is true when that happens.
   *
   * @param tabId - Browser tab id.
   * @param options - Optional `{ fullPage }` (default false).
   * @returns PNG data URL, base64 payload, and optional truncation flag.
   */
  browserCapturePage: (
    tabId: string,
    options?: { fullPage?: boolean }
  ) => Promise<{ dataUrl: string; pngBase64: string; truncated?: boolean }>;

  /**
   * Subscribes to guest navigation and title updates.
   *
   * @param callback - Handler invoked with navigation state.
   * @returns Unsubscribe function.
   */
  onBrowserNavigation: (callback: (state: BrowserNavigationState) => void) => () => void;

  /**
   * Subscribes to guest popup / new-tab requests (`target="_blank"`, `window.open()`).
   *
   * @param callback - Handler invoked with the open-tab request.
   * @returns Unsubscribe function.
   */
  onBrowserOpenTab: (callback: (request: BrowserOpenTabRequest) => void) => () => void;
}
