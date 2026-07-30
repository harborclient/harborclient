import type { BrowserTab } from '#/renderer/src/store/tabs';

/**
 * Follow-up DOM tools referenced from the webpage_tab `dom` descriptor.
 */
export const WEBPAGE_DOM_TOOLS = [
  'webpage_query',
  'webpage_evaluate',
  'webpage_inject_script',
  'webpage_inject_stylesheet'
] as const;

/**
 * Maximum JSON characters returned from webpage_evaluate / inject results.
 */
export const WEBPAGE_EVAL_RESULT_MAX_CHARS = 16_384;

/**
 * Structured tab info returned by webpage_tab, including a DOM tool descriptor.
 */
export interface WebpageTabInfo {
  /**
   * Browser tab id.
   */
  tabId: string;

  /**
   * Current / requested page URL.
   */
  url: string;

  /**
   * Document title shown in the tab bar.
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
   * Descriptor telling the agent which tools operate on this tab's DOM.
   */
  dom: {
    /**
     * Same as tabId; passed to webpage_query / evaluate / inject tools.
     */
    tabId: string;

    /**
     * Tools that accept this tabId for live page operations.
     */
    tools: readonly (typeof WEBPAGE_DOM_TOOLS)[number][];
  };
}

/**
 * Formats a browser tab into the webpage_tab tool result shape.
 *
 * @param tab - Browser tab from Redux (may be stale vs guest URL/title).
 * @param overrides - Optional navigation fields from waitForLoad / guest snapshot.
 * @returns Agent-facing tab info with DOM tool descriptor.
 */
export function formatWebpageTabInfo(
  tab: Pick<BrowserTab, 'tabId' | 'url' | 'title' | 'canGoBack' | 'canGoForward'>,
  overrides?: Partial<Pick<WebpageTabInfo, 'url' | 'title' | 'canGoBack' | 'canGoForward'>>
): WebpageTabInfo {
  const tabId = tab.tabId;
  return {
    tabId,
    url: overrides?.url ?? tab.url,
    title: overrides?.title ?? tab.title,
    canGoBack: overrides?.canGoBack ?? tab.canGoBack,
    canGoForward: overrides?.canGoForward ?? tab.canGoForward,
    dom: {
      tabId,
      tools: [...WEBPAGE_DOM_TOOLS]
    }
  };
}

/**
 * Caps a JSON-serializable evaluate/inject result for the model context.
 *
 * @param value - Raw result from the guest page.
 * @param maxChars - Maximum JSON string length before truncation.
 * @returns Object with result, or truncated preview fields when too large.
 */
export function capWebpageEvalResult(
  value: unknown,
  maxChars: number = WEBPAGE_EVAL_RESULT_MAX_CHARS
):
  | { result: unknown }
  | {
      resultTruncated: true;
      resultPreview: string;
      resultOriginalLength: number;
      resultType: string;
    } {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    serialized = JSON.stringify(String(value));
  }
  if (serialized === undefined) {
    serialized = 'null';
  }
  if (serialized.length <= maxChars) {
    try {
      return { result: JSON.parse(serialized) as unknown };
    } catch {
      return { result: value };
    }
  }
  return {
    resultTruncated: true,
    resultPreview: serialized.slice(0, maxChars),
    resultOriginalLength: serialized.length,
    resultType: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
  };
}

/**
 * Reads a non-empty string field from unknown tool args.
 *
 * @param args - Parsed tool arguments.
 * @param key - Property name.
 * @returns Trimmed string, or null when missing/invalid.
 */
export function readRequiredStringArg(args: unknown, key: string): string | null {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return null;
  }
  const value = (args as Record<string, unknown>)[key];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Reads an optional string field from unknown tool args.
 *
 * @param args - Parsed tool arguments.
 * @param key - Property name.
 * @returns Trimmed string, undefined when absent, or null when present but invalid.
 */
export function readOptionalStringArg(args: unknown, key: string): string | undefined | null {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return undefined;
  }
  if (!(key in (args as Record<string, unknown>))) {
    return undefined;
  }
  const value = (args as Record<string, unknown>)[key];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Reads an optional boolean field from unknown tool args.
 *
 * @param args - Parsed tool arguments.
 * @param key - Property name.
 * @returns Boolean, undefined when absent, or null when present but invalid.
 */
export function readOptionalBooleanArg(args: unknown, key: string): boolean | undefined | null {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return undefined;
  }
  if (!(key in (args as Record<string, unknown>))) {
    return undefined;
  }
  const value = (args as Record<string, unknown>)[key];
  if (typeof value !== 'boolean') {
    return null;
  }
  return value;
}

/**
 * Reads an optional finite number field from unknown tool args.
 *
 * @param args - Parsed tool arguments.
 * @param key - Property name.
 * @returns Number, undefined when absent, or null when present but invalid.
 */
export function readOptionalNumberArg(args: unknown, key: string): number | undefined | null {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return undefined;
  }
  if (!(key in (args as Record<string, unknown>))) {
    return undefined;
  }
  const value = (args as Record<string, unknown>)[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}
