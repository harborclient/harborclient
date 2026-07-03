import * as cheerio from 'cheerio';

/**
 * Element surface exposed to post-request scripts for HTML response querying.
 */
export interface ScriptElementFacade {
  /**
   * Concatenated text content of the element and its descendants.
   */
  textContent: string;

  /**
   * Returns the named attribute value, or null when absent.
   *
   * @param name - Attribute name (case-sensitive per HTML rules).
   */
  getAttribute(name: string): string | null;

  /**
   * Serialized inner HTML of the element's children.
   */
  innerHTML: string;
}

/**
 * Document surface backed by Cheerio for querying HTML response bodies.
 */
export interface ScriptDocumentFacade {
  /**
   * Returns the first element matching a CSS selector, or null when none match.
   *
   * @param selector - CSS selector understood by Cheerio.
   */
  querySelector(selector: string): ScriptElementFacade | null;

  /**
   * Returns every element matching a CSS selector.
   *
   * @param selector - CSS selector understood by Cheerio.
   */
  querySelectorAll(selector: string): ScriptElementFacade[];
}

/**
 * Wraps a Cheerio element selection as a plain object safe for the SES sandbox.
 *
 * @param selection - Cheerio wrapper around one or more parsed nodes.
 * @returns Element facade, or null when the selection is empty.
 */
function wrapElement(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cheerio node type is internal to the parser
  selection: cheerio.Cheerio<any>
): ScriptElementFacade | null {
  if (selection.length === 0) {
    return null;
  }

  return {
    get textContent() {
      return selection.text();
    },
    getAttribute: (name: string) => selection.attr(name) ?? null,
    get innerHTML() {
      return selection.html() ?? '';
    }
  };
}

/**
 * Parses an HTML response body into a DOM-like document facade for script sandboxes.
 *
 * Uses Cheerio under the hood; returned objects are plain facades without exposing
 * the Cheerio instance to user scripts.
 *
 * @param html - Raw response body string.
 * @returns Document with querySelector helpers.
 */
export function parseResponseDocument(html: string): ScriptDocumentFacade {
  const $ = cheerio.load(html);

  return {
    querySelector: (selector: string) => wrapElement($(selector).first()),
    querySelectorAll: (selector: string) => {
      const matches: ScriptElementFacade[] = [];
      $(selector).each((_index, node) => {
        const facade = wrapElement($(node));
        if (facade) {
          matches.push(facade);
        }
      });
      return matches;
    }
  };
}
