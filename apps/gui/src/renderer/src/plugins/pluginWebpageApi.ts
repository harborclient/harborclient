import type { ScriptWebpageRequest } from '@harborclient/core/scripting/scriptApi';
import type { PluginWebpageHandle } from '@harborclient/sdk';
import { executeScriptWebpageRequest } from '#/renderer/src/scripting/scriptWebpageBridge';
import { isWebpageSessionError } from '#/renderer/src/store/browser/webpageSession';

/**
 * Throws when a webpage session result is an `{ error }` object.
 *
 * @param result - Raw session helper result.
 * @returns The result when it is not an error.
 * @throws When the session returned `{ error: string }`.
 */
function unwrapWebpageResult(result: unknown): unknown {
  if (isWebpageSessionError(result)) {
    throw new Error(result.error);
  }
  return result;
}

/**
 * Normalizes the optional second argument to `hc.webpage(url, options)`.
 *
 * @param options - User-provided options.
 * @returns Normalized open options.
 */
function normalizeWebpageOpenOptions(options?: unknown): { reuse?: boolean } {
  if (options == null) {
    return {};
  }
  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('hc.webpage options must be an object');
  }
  const raw = options as Record<string, unknown>;
  if (!('reuse' in raw) || raw.reuse === undefined) {
    return {};
  }
  if (typeof raw.reuse !== 'boolean') {
    throw new Error('hc.webpage options.reuse must be a boolean');
  }
  return { reuse: raw.reuse };
}

/**
 * Invokes {@link executeScriptWebpageRequest} and unwraps session errors.
 *
 * @param req - Webpage operation payload.
 * @returns Operation result from the host session.
 */
async function callWebpage(req: ScriptWebpageRequest): Promise<unknown> {
  return unwrapWebpageResult(await executeScriptWebpageRequest(req));
}

/**
 * Builds a webpage handle whose methods call the host webpage session.
 *
 * @param tab - Opened tab metadata from the session.
 * @param writeScreenshotBytes - Optional writer used by `page.screenshot`.
 * @returns Plain-object handle for in-process plugin contexts.
 */
function createWebpageHandle(
  tab: {
    tabId: string;
    url: string;
    title: string;
    canGoBack?: boolean;
    canGoForward?: boolean;
  },
  writeScreenshotBytes?: (path: string, pngBase64: string) => Promise<string>
): PluginWebpageHandle {
  const tabId = tab.tabId;
  return {
    tabId,
    url: tab.url,
    title: tab.title,
    canGoBack: tab.canGoBack === true,
    canGoForward: tab.canGoForward === true,
    /**
     * Focuses this browser tab in the HarborClient tab bar.
     *
     * @returns Resolves when the tab is focused.
     */
    focus: async (): Promise<void> => {
      await callWebpage({ op: 'focus', tabId });
    },
    /**
     * Closes this browser tab, honoring page leave prompts.
     *
     * @returns True when closed; false when the user chose to stay.
     */
    close: async (): Promise<boolean> => {
      const result = (await callWebpage({ op: 'close', tabId })) as { closed: boolean };
      return result.closed === true;
    },
    /**
     * Captures the visible viewport (or full page) as PNG and writes it via the filesystem bridge.
     *
     * @param path - Relative or absolute allowlisted path.
     * @param screenshotOptions - Optional `{ fullPage }` (default false).
     * @returns Absolute path of the written file.
     */
    screenshot: async (
      path: string,
      screenshotOptions?: { fullPage?: boolean }
    ): Promise<{ path: string }> => {
      let fullPage = false;
      if (screenshotOptions != null) {
        if (typeof screenshotOptions !== 'object' || Array.isArray(screenshotOptions)) {
          throw new Error('hc.webpage().screenshot options must be an object');
        }
        if (
          'fullPage' in screenshotOptions &&
          screenshotOptions.fullPage !== undefined &&
          typeof screenshotOptions.fullPage !== 'boolean'
        ) {
          throw new Error('hc.webpage().screenshot options.fullPage must be a boolean');
        }
        fullPage = screenshotOptions.fullPage === true;
      }
      const pathText = String(path ?? '').trim();
      if (!pathText) {
        throw new Error('hc.webpage().screenshot requires a path');
      }
      if (!writeScreenshotBytes) {
        throw new Error('hc.webpage().screenshot requires hc.fs.writeBytes');
      }
      const capture = (await callWebpage({
        op: 'screenshot',
        tabId,
        fullPage: fullPage || undefined
      })) as { pngBase64?: string };
      if (!capture || typeof capture.pngBase64 !== 'string' || !capture.pngBase64) {
        throw new Error('hc.webpage().screenshot did not return image data');
      }
      const absolutePath = await writeScreenshotBytes(pathText, capture.pngBase64);
      return { path: absolutePath };
    },
    dom: {
      /**
       * Queries the live page DOM with a CSS selector.
       *
       * @param selector - CSS selector.
       * @param queryOptions - Optional `{ all, maxElements }`.
       * @returns Match count and element summaries.
       */
      query: async (
        selector: string,
        queryOptions?: { all?: boolean; maxElements?: number }
      ): Promise<{ selector: string; matchCount: number; elements: unknown[] }> => {
        const selectorText = String(selector ?? '').trim();
        if (!selectorText) {
          throw new Error('hc.webpage().dom.query requires a selector');
        }
        let all: boolean | undefined;
        let maxElements: number | undefined;
        if (queryOptions != null) {
          if (typeof queryOptions !== 'object' || Array.isArray(queryOptions)) {
            throw new Error('hc.webpage().dom.query options must be an object');
          }
          const raw = queryOptions as Record<string, unknown>;
          if ('all' in raw && raw.all !== undefined) {
            if (typeof raw.all !== 'boolean') {
              throw new Error('hc.webpage().dom.query options.all must be a boolean');
            }
            all = raw.all;
          }
          if ('maxElements' in raw && raw.maxElements !== undefined) {
            if (typeof raw.maxElements !== 'number' || !Number.isFinite(raw.maxElements)) {
              throw new Error('hc.webpage().dom.query options.maxElements must be a finite number');
            }
            maxElements = raw.maxElements;
          }
        }
        return (await callWebpage({
          op: 'query',
          tabId,
          selector: selectorText,
          all,
          maxElements
        })) as { selector: string; matchCount: number; elements: unknown[] };
      },
      /**
       * Evaluates JavaScript in the page main world and returns the result.
       *
       * @param expression - JavaScript source that returns a JSON-serializable value.
       * @returns Evaluation result.
       */
      evaluate: async (expression: string): Promise<unknown> => {
        const expressionText = String(expression ?? '').trim();
        if (!expressionText) {
          throw new Error('hc.webpage().dom.evaluate requires an expression');
        }
        const result = (await callWebpage({
          op: 'evaluate',
          tabId,
          expression: expressionText
        })) as { value: unknown };
        return result.value;
      },
      /**
       * Injects and runs JavaScript source in the page main world.
       *
       * @param source - JavaScript source to inject.
       * @returns Evaluation result from the injected script.
       */
      injectScript: async (source: string): Promise<unknown> => {
        const sourceText = String(source ?? '');
        if (!sourceText.trim()) {
          throw new Error('hc.webpage().dom.injectScript requires source');
        }
        const result = (await callWebpage({
          op: 'injectScript',
          tabId,
          source: sourceText
        })) as { value: unknown };
        return result.value;
      },
      /**
       * Injects a CSS stylesheet into the page.
       *
       * @param css - Stylesheet source.
       * @returns Electron insertion key.
       */
      injectStylesheet: async (css: string): Promise<string> => {
        const cssText = String(css ?? '');
        if (!cssText.trim()) {
          throw new Error('hc.webpage().dom.injectStylesheet requires css');
        }
        const result = (await callWebpage({
          op: 'injectStylesheet',
          tabId,
          css: cssText
        })) as { key: string };
        return result.key;
      }
    }
  };
}

/**
 * Opens or reuses an embedded browser tab and returns a control handle.
 *
 * Used by in-process {@link createPluginContext} (tests / non-bridged hosts).
 *
 * @param url - Optional URL; omit to bind the active browser tab.
 * @param openOptions - Optional `{ reuse }` (default true).
 * @param writeScreenshotBytes - Optional writer used by `page.screenshot`.
 * @returns Webpage handle with focus/close and `dom` helpers.
 */
export async function openPluginWebpage(
  url?: unknown,
  openOptions?: unknown,
  writeScreenshotBytes?: (path: string, pngBase64: string) => Promise<string>
): Promise<PluginWebpageHandle> {
  const normalizedOptions = normalizeWebpageOpenOptions(openOptions);
  let openUrl: string | undefined;
  if (url !== undefined && url !== null) {
    const trimmed = String(url).trim();
    if (!trimmed) {
      throw new Error('hc.webpage requires a non-empty url when provided');
    }
    openUrl = trimmed;
  }
  const opened = (await callWebpage({
    op: 'open',
    url: openUrl,
    reuse: normalizedOptions.reuse
  })) as {
    tabId: string;
    url: string;
    title: string;
    canGoBack?: boolean;
    canGoForward?: boolean;
  };
  if (!opened || typeof opened.tabId !== 'string') {
    throw new Error('hc.webpage open did not return a tab');
  }
  return createWebpageHandle(opened, writeScreenshotBytes);
}
