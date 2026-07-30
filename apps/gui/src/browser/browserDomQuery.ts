/**
 * Options for querying elements in an embedded browser guest.
 */
export interface BrowserDomQueryOptions {
  /**
   * CSS selector to match against the live document.
   */
  selector: string;

  /**
   * When true, return every match up to maxElements; when false, only the first.
   */
  all?: boolean;

  /**
   * Maximum number of elements to return (clamped).
   */
  maxElements?: number;
}

/**
 * Cap on how many elements a DOM query may return.
 */
export const BROWSER_DOM_QUERY_MAX_ELEMENTS = 50;

/**
 * Default element count when the caller omits maxElements.
 */
export const BROWSER_DOM_QUERY_DEFAULT_ELEMENTS = 20;

/**
 * Max characters of textContent included per element summary.
 */
export const BROWSER_DOM_QUERY_MAX_TEXT = 2000;

/**
 * Max characters of outerHTML included per element summary.
 */
export const BROWSER_DOM_QUERY_MAX_HTML = 4000;

/**
 * One element summary returned from a live guest CSS query.
 */
export interface BrowserDomElementSummary {
  /**
   * Uppercase HTML tag name.
   */
  tagName: string;

  /**
   * Element id attribute, or empty string when absent.
   */
  id: string;

  /**
   * Element className string.
   */
  className: string;

  /**
   * Capped text content of the element and its descendants.
   */
  textContent: string;

  /**
   * Capped serialized outer HTML.
   */
  outerHTML: string;

  /**
   * Attribute name/value map (values capped per attribute).
   */
  attributes: Record<string, string>;
}

/**
 * Result of a live guest CSS selector query.
 */
export interface BrowserDomQueryResult {
  /**
   * Selector that was evaluated.
   */
  selector: string;

  /**
   * Number of matches before maxElements clamping.
   */
  matchCount: number;

  /**
   * Element summaries (length ≤ maxElements).
   */
  elements: BrowserDomElementSummary[];
}

/**
 * Builds an in-page script that queries the live DOM and returns capped element summaries.
 *
 * The returned script is executed via `webContents.executeJavaScript` and must not
 * interpolate untrusted values without JSON encoding.
 *
 * @param options - Selector and result limits.
 * @returns JavaScript source that evaluates to {@link BrowserDomQueryResult}.
 */
export function buildBrowserDomQueryScript(options: BrowserDomQueryOptions): string {
  const all = options.all === true;
  const requested =
    typeof options.maxElements === 'number' && Number.isFinite(options.maxElements)
      ? Math.floor(options.maxElements)
      : BROWSER_DOM_QUERY_DEFAULT_ELEMENTS;
  const maxElements = Math.min(
    BROWSER_DOM_QUERY_MAX_ELEMENTS,
    Math.max(1, requested > 0 ? requested : BROWSER_DOM_QUERY_DEFAULT_ELEMENTS)
  );
  const selectorJson = JSON.stringify(options.selector);
  const maxText = BROWSER_DOM_QUERY_MAX_TEXT;
  const maxHtml = BROWSER_DOM_QUERY_MAX_HTML;

  return `(() => {
  const selector = ${selectorJson};
  const all = ${all ? 'true' : 'false'};
  const maxElements = ${maxElements};
  const maxText = ${maxText};
  const maxHtml = ${maxHtml};
  const cap = (value, max) => {
    const text = value == null ? '' : String(value);
    return text.length > max ? text.slice(0, max) : text;
  };
  const summarize = (el) => {
    const attributes = {};
    if (el && el.attributes) {
      for (const attr of Array.from(el.attributes)) {
        attributes[attr.name] = cap(attr.value, maxText);
      }
    }
    return {
      tagName: el && el.tagName ? String(el.tagName) : '',
      id: el && typeof el.id === 'string' ? el.id : '',
      className: el && typeof el.className === 'string' ? el.className : '',
      textContent: cap(el ? el.textContent : '', maxText),
      outerHTML: cap(el && typeof el.outerHTML === 'string' ? el.outerHTML : '', maxHtml),
      attributes
    };
  };
  try {
    if (all) {
      const nodes = Array.from(document.querySelectorAll(selector));
      return {
        selector,
        matchCount: nodes.length,
        elements: nodes.slice(0, maxElements).map(summarize)
      };
    }
    const node = document.querySelector(selector);
    return {
      selector,
      matchCount: node ? 1 : 0,
      elements: node ? [summarize(node)] : []
    };
  } catch (error) {
    return {
      selector,
      matchCount: 0,
      elements: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
})()`;
}
