import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { normalizeBrowserAddressInput, browserUrlsMatch } from '#/browser/browserUrl';
import { isBrowserTab, type BrowserTab } from '#/renderer/src/store/tabs';
import { closeTab, newBrowserTab, setActiveTab } from '#/renderer/src/store/slices/tabsSlice';
import { selectActiveBrowserTab, selectTabs } from '#/renderer/src/store/selectors';
import {
  clearBrowserGuest,
  hasBrowserGuest,
  markBrowserGuestCreated
} from '#/renderer/src/ui/Main/RequestEditor/BrowserTab/browserGuestRegistry';
import { formatWebpageTabInfo, type WebpageTabInfo } from '#/renderer/src/store/ai/webpageTools';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Redux accessors shared by AI tools and the script webpage bridge.
 */
export interface WebpageSessionContext {
  /**
   * Returns the current Redux root state.
   */
  getState: () => RootState;

  /**
   * Dispatches a Redux action or thunk.
   */
  dispatch: ThunkDispatch<RootState, unknown, UnknownAction>;
}

/**
 * Error shape returned by webpage session helpers instead of throwing.
 */
export interface WebpageSessionError {
  /**
   * Human-readable failure reason.
   */
  error: string;
}

/**
 * Options for {@link openOrReuseWebpageTab}.
 */
export interface OpenWebpageTabOptions {
  /**
   * URL to find or open. When omitted, returns the active browser tab.
   */
  url?: string;

  /**
   * When true (default), reuse an open browser tab whose URL matches.
   * When false, always open a new tab.
   */
  reuse?: boolean;
}

/**
 * Result of a live DOM CSS selector query.
 */
export interface WebpageDomQueryResult {
  /**
   * Selector that was queried.
   */
  selector: string;

  /**
   * Number of matches before capping.
   */
  matchCount: number;

  /**
   * Matched element summaries.
   */
  elements: unknown[];
}

/**
 * Resolves a browser tab by id from Redux state.
 *
 * @param state - Current Redux root state.
 * @param tabId - Browser tab id.
 * @returns Browser tab, or null when missing / not a browser tab.
 */
export function findBrowserTabById(state: RootState, tabId: string): BrowserTab | null {
  const tab = selectTabs(state).find((candidate) => candidate.tabId === tabId);
  if (!tab || !isBrowserTab(tab)) {
    return null;
  }
  return tab;
}

/**
 * Opens a new browser tab, reuses a matching open tab, or returns the active browser tab.
 *
 * @param ctx - Redux getState and dispatch.
 * @param options - Optional url and reuse flag.
 * @returns Tab info with dom descriptor, or an error object.
 */
export async function openOrReuseWebpageTab(
  ctx: WebpageSessionContext,
  options: OpenWebpageTabOptions = {}
): Promise<WebpageTabInfo | WebpageSessionError> {
  const urlArg = options.url;
  if (urlArg !== undefined && (typeof urlArg !== 'string' || urlArg.trim().length === 0)) {
    return { error: 'url must be a non-empty string when provided.' };
  }

  if (urlArg === undefined) {
    const active = selectActiveBrowserTab(ctx.getState());
    if (!active) {
      return { error: 'No active browser tab.' };
    }
    return formatWebpageTabInfo(active);
  }

  const normalized = normalizeBrowserAddressInput(urlArg);
  if (!normalized) {
    return {
      error: 'Invalid or disallowed URL. Use http, https, or about:blank.'
    };
  }

  const reuse = options.reuse !== false;
  if (reuse) {
    const existing = selectTabs(ctx.getState()).find(
      (tab) => isBrowserTab(tab) && browserUrlsMatch(tab.url, normalized)
    );
    if (existing && isBrowserTab(existing)) {
      ctx.dispatch(setActiveTab(existing.tabId));
      return formatWebpageTabInfo(existing);
    }
  }

  const tabId = crypto.randomUUID();
  ctx.dispatch(newBrowserTab({ tabId, url: normalized, homeUrl: normalized }));

  try {
    if (!hasBrowserGuest(tabId)) {
      await window.api.browserCreate(tabId, normalized, normalized, []);
      markBrowserGuestCreated(tabId);
    }
    const navigation = await window.api.browserWaitForLoad(tabId);
    const tab = findBrowserTabById(ctx.getState(), tabId);
    if (!tab) {
      return {
        error: 'Browser tab was closed before load completed.'
      };
    }
    return formatWebpageTabInfo(tab, {
      url: navigation.url,
      title: navigation.title,
      canGoBack: navigation.canGoBack,
      canGoForward: navigation.canGoForward
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to open browser tab.';
    return { error: message };
  }
}

/**
 * Focuses an open browser tab in the tab bar.
 *
 * @param ctx - Redux getState and dispatch.
 * @param tabId - Browser tab id.
 * @returns Success or error when the tab is missing.
 */
export function focusWebpageTab(
  ctx: WebpageSessionContext,
  tabId: string
): { ok: true } | WebpageSessionError {
  if (!findBrowserTabById(ctx.getState(), tabId)) {
    return { error: `No browser tab found for tabId "${tabId}".` };
  }
  ctx.dispatch(setActiveTab(tabId));
  return { ok: true };
}

/**
 * Closes a browser tab, honoring page leave prompts.
 *
 * @param ctx - Redux getState and dispatch.
 * @param tabId - Browser tab id.
 * @returns Whether the tab closed, or an error when missing.
 */
export async function closeWebpageTab(
  ctx: WebpageSessionContext,
  tabId: string
): Promise<{ closed: boolean } | WebpageSessionError> {
  if (!findBrowserTabById(ctx.getState(), tabId)) {
    return { error: `No browser tab found for tabId "${tabId}".` };
  }

  try {
    const closed = await window.api.browserRequestClose(tabId);
    if (!closed) {
      return { closed: false };
    }
    clearBrowserGuest(tabId);
    ctx.dispatch(closeTab(tabId));
    return { closed: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to close browser tab.';
    return { error: message };
  }
}

/**
 * Queries the live DOM of a browser tab with a CSS selector.
 *
 * @param state - Current Redux root state.
 * @param tabId - Browser tab id.
 * @param selector - CSS selector.
 * @param all - When true, return every match up to maxElements.
 * @param maxElements - Maximum elements to return.
 * @returns Query result or error.
 */
export async function queryWebpageDom(
  state: RootState,
  tabId: string,
  selector: string,
  all?: boolean,
  maxElements?: number
): Promise<WebpageDomQueryResult | WebpageSessionError> {
  if (!findBrowserTabById(state, tabId)) {
    return { error: `No browser tab found for tabId "${tabId}".` };
  }

  try {
    return await window.api.browserQuerySelector(tabId, selector, all, maxElements);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'DOM query failed.';
    return { error: message };
  }
}

/**
 * Evaluates JavaScript in a browser tab page main world.
 *
 * @param state - Current Redux root state.
 * @param tabId - Browser tab id.
 * @param expression - JavaScript source to evaluate.
 * @returns Raw evaluation value or error.
 */
export async function evaluateWebpage(
  state: RootState,
  tabId: string,
  expression: string
): Promise<{ value: unknown } | WebpageSessionError> {
  if (!findBrowserTabById(state, tabId)) {
    return { error: `No browser tab found for tabId "${tabId}".` };
  }

  try {
    const value = await window.api.browserExecuteJavaScript(tabId, expression);
    return { value };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Evaluate failed.';
    return { error: message };
  }
}

/**
 * Injects and runs JavaScript source in a browser tab page main world.
 *
 * @param state - Current Redux root state.
 * @param tabId - Browser tab id.
 * @param source - JavaScript source to inject.
 * @returns Raw evaluation value or error.
 */
export async function injectWebpageScript(
  state: RootState,
  tabId: string,
  source: string
): Promise<{ value: unknown } | WebpageSessionError> {
  if (!findBrowserTabById(state, tabId)) {
    return { error: `No browser tab found for tabId "${tabId}".` };
  }

  try {
    const value = await window.api.browserExecuteJavaScript(tabId, source);
    return { value };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Script injection failed.';
    return { error: message };
  }
}

/**
 * Injects a CSS stylesheet into a browser tab page.
 *
 * @param state - Current Redux root state.
 * @param tabId - Browser tab id.
 * @param css - Stylesheet source.
 * @returns Insertion key or error.
 */
export async function injectWebpageStylesheet(
  state: RootState,
  tabId: string,
  css: string
): Promise<{ key: string } | WebpageSessionError> {
  if (!findBrowserTabById(state, tabId)) {
    return { error: `No browser tab found for tabId "${tabId}".` };
  }

  try {
    const key = await window.api.browserInsertCSS(tabId, css);
    return { key };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Stylesheet injection failed.';
    return { error: message };
  }
}

/**
 * Captures a PNG screenshot of a browser tab's visible viewport or full page.
 *
 * @param state - Current Redux root state.
 * @param tabId - Browser tab id.
 * @param fullPage - When true, scroll-stitch the full document.
 * @returns PNG data URL and base64 payload, or an error.
 */
export async function screenshotWebpage(
  state: RootState,
  tabId: string,
  fullPage?: boolean
): Promise<{ dataUrl: string; pngBase64: string } | WebpageSessionError> {
  if (!findBrowserTabById(state, tabId)) {
    return { error: `No browser tab found for tabId "${tabId}".` };
  }

  try {
    return await window.api.browserCapturePage(tabId, { fullPage: fullPage === true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Screenshot failed.';
    return { error: message };
  }
}

/**
 * Returns whether a session result is an error object.
 *
 * @param result - Session helper return value.
 * @returns True when the result is exactly `{ error: string }`.
 */
export function isWebpageSessionError(result: unknown): result is WebpageSessionError {
  if (result == null || typeof result !== 'object' || Array.isArray(result)) {
    return false;
  }
  const keys = Object.keys(result);
  return (
    keys.length === 1 &&
    keys[0] === 'error' &&
    typeof (result as WebpageSessionError).error === 'string'
  );
}
