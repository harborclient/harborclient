/**
 * Throws when a webpage bridge result is an `{ error }` object.
 *
 * @param {unknown} result - Raw bridge result.
 * @returns {unknown} The result when it is not an error.
 * @throws {Error} When the bridge returned `{ error: string }`.
 */
export function unwrapWebpageBridgeResult(result) {
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
 * Normalizes the optional second argument to `hc.webpage(url, options)`.
 *
 * @param {unknown} [options] - User-provided options.
 * @returns {{ reuse?: boolean }} Normalized open options.
 */
export function normalizeWebpageOpenOptions(options) {
  if (options == null) {
    return {};
  }
  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('hc.webpage options must be an object');
  }
  const raw = /** @type {Record<string, unknown>} */ (options);
  if (!('reuse' in raw) || raw.reuse === undefined) {
    return {};
  }
  if (typeof raw.reuse !== 'boolean') {
    throw new Error('hc.webpage options.reuse must be a boolean');
  }
  return { reuse: raw.reuse };
}

/**
 * Normalizes optional `hc.webpage().screenshot` options.
 *
 * @param {unknown} [options] - User-provided options (`fullPage` optional).
 * @returns {{ fullPage: boolean }} Normalized options (default `fullPage: false`).
 * @throws {Error} When options is present but not a plain object, or `fullPage` is not a boolean.
 */
export function normalizeWebpageScreenshotOptions(options) {
  if (options == null) {
    return { fullPage: false };
  }
  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('hc.webpage().screenshot options must be an object');
  }
  const raw = /** @type {Record<string, unknown>} */ (options);
  if (!('fullPage' in raw) || raw.fullPage === undefined) {
    return { fullPage: false };
  }
  if (typeof raw.fullPage !== 'boolean') {
    throw new Error('hc.webpage().screenshot options.fullPage must be a boolean');
  }
  return { fullPage: raw.fullPage };
}

/**
 * Builds a webpage handle whose methods call the host webpage bridge.
 *
 * @param {{
 *   tabId: string;
 *   url: string;
 *   title: string;
 *   canGoBack?: boolean;
 *   canGoForward?: boolean;
 * }} tab - Opened tab metadata from the bridge.
 * @param {(req: Record<string, unknown>) => Promise<unknown>} callWebpage - Bridge transport.
 * @param {(path: string, pngBase64: string) => Promise<string>} [writeScreenshotBytes] - Optional
 *   writer that saves PNG base64 under an allowlisted path and returns the absolute path.
 * @returns {import('../types').PluginWebpageHandle} Plain-object handle for the plugin world.
 */
export function createWebpageHandle(tab, callWebpage, writeScreenshotBytes) {
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
     * @returns {Promise<void>} Resolves when the tab is focused.
     */
    focus: async () => {
      unwrapWebpageBridgeResult(await callWebpage({ op: 'focus', tabId }));
    },
    /**
     * Closes this browser tab, honoring page leave prompts.
     *
     * @returns {Promise<boolean>} True when closed; false when the user chose to stay.
     */
    close: async () => {
      const result = /** @type {{ closed: boolean }} */ (
        unwrapWebpageBridgeResult(await callWebpage({ op: 'close', tabId }))
      );
      return result.closed === true;
    },
    /**
     * Captures the visible viewport (or full page) as PNG and writes it via the filesystem bridge.
     *
     * @param {unknown} path - Relative (plugin root) or absolute allowlisted path.
     * @param {unknown} [screenshotOptions] - Optional `{ fullPage }` (default false).
     * @returns {Promise<{ path: string }>} Absolute path of the written file.
     */
    screenshot: async (path, screenshotOptions) => {
      const { fullPage } = normalizeWebpageScreenshotOptions(screenshotOptions);
      const pathText = String(path ?? '').trim();
      if (!pathText) {
        throw new Error('hc.webpage().screenshot requires a path');
      }
      if (!writeScreenshotBytes) {
        throw new Error('hc.webpage().screenshot requires hc.fs.writeBytes');
      }
      const capture = /** @type {{ pngBase64?: string }} */ (
        unwrapWebpageBridgeResult(await callWebpage({ op: 'screenshot', tabId, fullPage }))
      );
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
       * @param {string} selector - CSS selector.
       * @param {{ all?: boolean; maxElements?: number }} [queryOptions] - Optional query flags.
       * @returns {Promise<{ selector: string; matchCount: number; elements: unknown[] }>}
       */
      query: async (selector, queryOptions) => {
        const selectorText = String(selector ?? '').trim();
        if (!selectorText) {
          throw new Error('hc.webpage().dom.query requires a selector');
        }
        let all;
        let maxElements;
        if (queryOptions != null) {
          if (typeof queryOptions !== 'object' || Array.isArray(queryOptions)) {
            throw new Error('hc.webpage().dom.query options must be an object');
          }
          const raw = /** @type {Record<string, unknown>} */ (queryOptions);
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
        return /** @type {{ selector: string; matchCount: number; elements: unknown[] }} */ (
          unwrapWebpageBridgeResult(
            await callWebpage({ op: 'query', tabId, selector: selectorText, all, maxElements })
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
          throw new Error('hc.webpage().dom.evaluate requires an expression');
        }
        const result = /** @type {{ value: unknown }} */ (
          unwrapWebpageBridgeResult(
            await callWebpage({ op: 'evaluate', tabId, expression: expressionText })
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
          throw new Error('hc.webpage().dom.injectScript requires source');
        }
        const result = /** @type {{ value: unknown }} */ (
          unwrapWebpageBridgeResult(
            await callWebpage({ op: 'injectScript', tabId, source: sourceText })
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
          throw new Error('hc.webpage().dom.injectStylesheet requires css');
        }
        const result = /** @type {{ key: string }} */ (
          unwrapWebpageBridgeResult(
            await callWebpage({ op: 'injectStylesheet', tabId, css: cssText })
          )
        );
        return result.key;
      }
    }
  };
}

/**
 * Opens or reuses an embedded browser tab and returns a control handle.
 *
 * @param {(req: Record<string, unknown>) => Promise<unknown>} callWebpage - Bridge transport
 *   that accepts ScriptWebpageRequest-shaped payloads (`op` plus fields).
 * @param {unknown} [url] - Optional URL; omit to bind the active browser tab.
 * @param {unknown} [openOptions] - Optional `{ reuse }` (default true).
 * @param {(path: string, pngBase64: string) => Promise<string>} [writeScreenshotBytes] - Optional
 *   writer used by `page.screenshot`.
 * @returns {Promise<import('../types').PluginWebpageHandle>} Webpage handle.
 */
export async function openWebpage(callWebpage, url, openOptions, writeScreenshotBytes) {
  const normalizedOptions = normalizeWebpageOpenOptions(openOptions);
  let openUrl;
  if (url !== undefined && url !== null) {
    const trimmed = String(url).trim();
    if (!trimmed) {
      throw new Error('hc.webpage requires a non-empty url when provided');
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
    unwrapWebpageBridgeResult(
      await callWebpage({
        op: 'open',
        url: openUrl,
        reuse: normalizedOptions.reuse
      })
    )
  );
  if (!opened || typeof opened.tabId !== 'string') {
    throw new Error('hc.webpage open did not return a tab');
  }
  return createWebpageHandle(opened, callWebpage, writeScreenshotBytes);
}
