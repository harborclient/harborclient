/**
 * Throws when a live-page bridge result is an `{ error }` object.
 *
 * @param {unknown} result - Raw bridge result.
 * @returns {unknown} The result when it is not an error.
 * @throws {Error} When the bridge returned `{ error: string }`.
 */
export function unwrapLivePageBridgeResult(result) {
  if (
    result != null &&
    typeof result === 'object' &&
    !Array.isArray(result) &&
    Object.keys(result).length === 1 &&
    'error' in result &&
    typeof (/** @type {{ error: unknown }} */ (result).error) === 'string'
  ) {
    throw new Error(/** @type {{ error: string }} */ (result).error);
  }
  return result;
}

/**
 * Normalizes the optional second argument to `hc.livePage(url, options)`.
 *
 * @param {unknown} [options] - User-provided options.
 * @returns {{ reuse?: boolean }} Normalized open options.
 */
export function normalizeLivePageOpenOptions(options) {
  if (options == null) {
    return {};
  }
  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('hc.livePage options must be an object');
  }
  const raw = /** @type {Record<string, unknown>} */ (options);
  if (!('reuse' in raw) || raw.reuse === undefined) {
    return {};
  }
  if (typeof raw.reuse !== 'boolean') {
    throw new Error('hc.livePage options.reuse must be a boolean');
  }
  return { reuse: raw.reuse };
}

/**
 * Normalizes optional `hc.livePage().screenshot` options.
 *
 * @param {unknown} [options] - User-provided options (`fullPage` optional).
 * @returns {{ fullPage: boolean }} Normalized options (default `fullPage: false`).
 * @throws {Error} When options is present but not a plain object, or `fullPage` is not a boolean.
 */
export function normalizeLivePageScreenshotOptions(options) {
  if (options == null) {
    return { fullPage: false };
  }
  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('hc.livePage().screenshot options must be an object');
  }
  const raw = /** @type {Record<string, unknown>} */ (options);
  if (!('fullPage' in raw) || raw.fullPage === undefined) {
    return { fullPage: false };
  }
  if (typeof raw.fullPage !== 'boolean') {
    throw new Error('hc.livePage().screenshot options.fullPage must be a boolean');
  }
  return { fullPage: raw.fullPage };
}

/**
 * Builds a live-page handle whose methods call the host live page bridge.
 *
 * @param {{
 *   tabId: string;
 *   url: string;
 *   title: string;
 *   canGoBack?: boolean;
 *   canGoForward?: boolean;
 * }} tab - Opened tab metadata from the bridge.
 * @param {(req: Record<string, unknown>) => Promise<unknown>} callLivePage - Bridge transport.
 * @param {(path: string, pngBase64: string) => Promise<string>} [writeScreenshotBytes] - Optional
 *   writer that saves PNG base64 under an allowlisted path and returns the absolute path.
 * @returns {import('../types').PluginLivePageHandle} Plain-object handle for the plugin world.
 */
export function createLivePageHandle(tab, callLivePage, writeScreenshotBytes) {
  const tabId = tab.tabId;
  /** @type {import('../types').PluginLivePageHandle} */
  const handle = {
    tabId,
    url: tab.url,
    title: tab.title,
    canGoBack: tab.canGoBack === true,
    canGoForward: tab.canGoForward === true,
    /**
     * Focuses this browser tab in the HarborClient tab bar.
     *
     * @returns {Promise<void>} Resolves when the tab is focused.
     */
    focus: async () => {
      unwrapLivePageBridgeResult(await callLivePage({ op: 'focus', tabId }));
    },
    /**
     * Closes this browser tab, honoring page leave prompts.
     *
     * @returns {Promise<boolean>} True when closed; false when the user chose to stay.
     */
    close: async () => {
      const result = /** @type {{ closed: boolean }} */ (
        unwrapLivePageBridgeResult(await callLivePage({ op: 'close', tabId }))
      );
      return result.closed === true;
    },
    /**
     * Navigates history back one entry and waits for load.
     *
     * @returns {Promise<void>} Resolves when load finishes.
     */
    goBack: async () => {
      applyLivePageNavSnapshot(
        handle,
        unwrapLivePageBridgeResult(await callLivePage({ op: 'goBack', tabId }))
      );
    },
    /**
     * Navigates history forward one entry and waits for load.
     *
     * @returns {Promise<void>} Resolves when load finishes.
     */
    goForward: async () => {
      applyLivePageNavSnapshot(
        handle,
        unwrapLivePageBridgeResult(await callLivePage({ op: 'goForward', tabId }))
      );
    },
    /**
     * Reloads the current page and waits for load.
     *
     * @returns {Promise<void>} Resolves when load finishes.
     */
    reload: async () => {
      applyLivePageNavSnapshot(
        handle,
        unwrapLivePageBridgeResult(await callLivePage({ op: 'reload', tabId }))
      );
    },
    /**
     * Loads a URL in this tab and waits for load.
     *
     * @param {unknown} url - Absolute http(s) or about:blank URL.
     * @returns {Promise<void>} Resolves when load finishes.
     */
    navigate: async (url) => {
      const urlText = String(url ?? '').trim();
      if (!urlText) {
        throw new Error('hc.livePage().navigate requires a non-empty url');
      }
      applyLivePageNavSnapshot(
        handle,
        unwrapLivePageBridgeResult(await callLivePage({ op: 'navigate', tabId, url: urlText }))
      );
    },
    /**
     * Captures the visible viewport (or full page) as PNG and writes it via the filesystem bridge.
     *
     * @param {unknown} path - Relative (plugin root) or absolute allowlisted path.
     * @param {unknown} [screenshotOptions] - Optional `{ fullPage }` (default false).
     * @returns {Promise<{ path: string }>} Absolute path of the written file.
     */
    screenshot: async (path, screenshotOptions) => {
      const { fullPage } = normalizeLivePageScreenshotOptions(screenshotOptions);
      const pathText = String(path ?? '').trim();
      if (!pathText) {
        throw new Error('hc.livePage().screenshot requires a path');
      }
      if (!writeScreenshotBytes) {
        throw new Error('hc.livePage().screenshot requires hc.fs.writeBytes');
      }
      const capture = /** @type {{ pngBase64?: string }} */ (
        unwrapLivePageBridgeResult(await callLivePage({ op: 'screenshot', tabId, fullPage }))
      );
      if (!capture || typeof capture.pngBase64 !== 'string' || !capture.pngBase64) {
        throw new Error('hc.livePage().screenshot did not return image data');
      }
      const absolutePath = await writeScreenshotBytes(pathText, capture.pngBase64);
      return { path: absolutePath };
    },
    dom: {
      /**
       * Queries the live page DOM with a CSS selector.
       *
       * @param {string} selector - CSS selector.
       * @param {{ all?: boolean; maxElements?: number }} [queryOptions] - Optional query flags.
       * @returns {Promise<{ selector: string; matchCount: number; elements: unknown[] }>}
       */
      query: async (selector, queryOptions) => {
        const selectorText = String(selector ?? '').trim();
        if (!selectorText) {
          throw new Error('hc.livePage().dom.query requires a selector');
        }
        let all;
        let maxElements;
        if (queryOptions != null) {
          if (typeof queryOptions !== 'object' || Array.isArray(queryOptions)) {
            throw new Error('hc.livePage().dom.query options must be an object');
          }
          const raw = /** @type {Record<string, unknown>} */ (queryOptions);
          if ('all' in raw && raw.all !== undefined) {
            if (typeof raw.all !== 'boolean') {
              throw new Error('hc.livePage().dom.query options.all must be a boolean');
            }
            all = raw.all;
          }
          if ('maxElements' in raw && raw.maxElements !== undefined) {
            if (typeof raw.maxElements !== 'number' || !Number.isFinite(raw.maxElements)) {
              throw new Error(
                'hc.livePage().dom.query options.maxElements must be a finite number'
              );
            }
            maxElements = raw.maxElements;
          }
        }
        return /** @type {{ selector: string; matchCount: number; elements: unknown[] }} */ (
          unwrapLivePageBridgeResult(
            await callLivePage({ op: 'query', tabId, selector: selectorText, all, maxElements })
          )
        );
      },
      /**
       * Evaluates JavaScript in the page main world and returns the result.
       *
       * @param {string} expression - JavaScript source that returns a JSON-serializable value.
       * @returns {Promise<unknown>} Evaluation result.
       */
      evaluate: async (expression) => {
        const expressionText = String(expression ?? '').trim();
        if (!expressionText) {
          throw new Error('hc.livePage().dom.evaluate requires an expression');
        }
        const result = /** @type {{ value: unknown }} */ (
          unwrapLivePageBridgeResult(
            await callLivePage({ op: 'evaluate', tabId, expression: expressionText })
          )
        );
        return result.value;
      },
      /**
       * Injects and runs JavaScript source in the page main world.
       *
       * @param {string} source - JavaScript source to inject.
       * @returns {Promise<unknown>} Evaluation result from the injected script.
       */
      injectScript: async (source) => {
        const sourceText = String(source ?? '');
        if (!sourceText.trim()) {
          throw new Error('hc.livePage().dom.injectScript requires source');
        }
        const result = /** @type {{ value: unknown }} */ (
          unwrapLivePageBridgeResult(
            await callLivePage({ op: 'injectScript', tabId, source: sourceText })
          )
        );
        return result.value;
      },
      /**
       * Injects a CSS stylesheet into the page.
       *
       * @param {string} css - Stylesheet source.
       * @returns {Promise<string>} Electron insertion key.
       */
      injectStylesheet: async (css) => {
        const cssText = String(css ?? '');
        if (!cssText.trim()) {
          throw new Error('hc.livePage().dom.injectStylesheet requires css');
        }
        const result = /** @type {{ key: string }} */ (
          unwrapLivePageBridgeResult(
            await callLivePage({ op: 'injectStylesheet', tabId, css: cssText })
          )
        );
        return result.key;
      }
    }
  };
  return handle;
}

/**
 * Copies navigation fields from a bridge result onto a live-page handle.
 *
 * @param {import('../types').PluginLivePageHandle} handle - Mutable handle to update.
 * @param {unknown} result - Bridge result with url/title/history flags.
 */
function applyLivePageNavSnapshot(handle, result) {
  if (result == null || typeof result !== 'object' || Array.isArray(result)) {
    return;
  }
  const snapshot = /** @type {Record<string, unknown>} */ (result);
  if (typeof snapshot.url === 'string') {
    handle.url = snapshot.url;
  }
  if (typeof snapshot.title === 'string') {
    handle.title = snapshot.title;
  }
  if (typeof snapshot.canGoBack === 'boolean') {
    handle.canGoBack = snapshot.canGoBack;
  }
  if (typeof snapshot.canGoForward === 'boolean') {
    handle.canGoForward = snapshot.canGoForward;
  }
}

/**
 * Opens or reuses an embedded browser tab and returns a control handle.
 *
 * @param {(req: Record<string, unknown>) => Promise<unknown>} callLivePage - Bridge transport
 *   that accepts ScriptLivePageRequest-shaped payloads (`op` plus fields).
 * @param {unknown} [url] - Optional URL; omit to bind the active browser tab.
 * @param {unknown} [openOptions] - Optional `{ reuse }` (default true).
 * @param {(path: string, pngBase64: string) => Promise<string>} [writeScreenshotBytes] - Optional
 *   writer used by `page.screenshot`.
 * @returns {Promise<import('../types').PluginLivePageHandle>} Live-page handle.
 */
export async function openLivePage(callLivePage, url, openOptions, writeScreenshotBytes) {
  const normalizedOptions = normalizeLivePageOpenOptions(openOptions);
  let openUrl;
  if (url !== undefined && url !== null) {
    const trimmed = String(url).trim();
    if (!trimmed) {
      throw new Error('hc.livePage requires a non-empty url when provided');
    }
    openUrl = trimmed;
  }
  const opened = /** @type {{
    tabId: string;
    url: string;
    title: string;
    canGoBack?: boolean;
    canGoForward?: boolean;
  }} */ (
    unwrapLivePageBridgeResult(
      await callLivePage({
        op: 'open',
        url: openUrl,
        reuse: normalizedOptions.reuse
      })
    )
  );
  if (!opened || typeof opened.tabId !== 'string') {
    throw new Error('hc.livePage open did not return a tab');
  }
  return createLivePageHandle(opened, callLivePage, writeScreenshotBytes);
}
