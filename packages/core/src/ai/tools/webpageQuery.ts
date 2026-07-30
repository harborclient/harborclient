import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the webpage_query tool.
 */
export interface WebpageQueryToolArgs {
  /**
   * Browser tab id from webpage_tab.
   */
  tabId: string;

  /**
   * CSS selector to match in the live page.
   */
  selector: string;

  /**
   * When true, return every match up to maxElements; otherwise only the first.
   */
  all?: boolean;

  /**
   * Maximum number of elements to return (capped by the host).
   */
  maxElements?: number;
}

/**
 * Queries the live DOM of a browser tab with a CSS selector.
 *
 * @param {string} tabId - Browser tab id from webpage_tab.
 * @param {string} selector - CSS selector.
 * @param {boolean} [all] - Return all matches when true.
 * @param {number} [maxElements] - Max elements to return.
 */
export const webpageQueryTool = {
  name: 'webpage_query',
  definition: {
    type: 'function',
    function: {
      name: 'webpage_query',
      description:
        'Queries the live DOM of an embedded browser tab with a CSS selector. Pass tabId from webpage_tab (or its dom.tabId). Returns capped element summaries (tagName, id, className, textContent, outerHTML, attributes). Prefer this over webpage_evaluate for reading page content. Set all=true to return multiple matches up to maxElements.',
      parameters: {
        type: 'object',
        properties: {
          tabId: {
            type: 'string',
            description: 'Browser tab id from webpage_tab.'
          },
          selector: {
            type: 'string',
            description: 'CSS selector to evaluate in the page document.'
          },
          all: {
            type: 'boolean',
            description:
              'When true, return every match up to maxElements; otherwise only the first.'
          },
          maxElements: {
            type: 'number',
            description: 'Maximum number of elements to return when all=true.'
          }
        },
        required: ['tabId', 'selector'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    tabId: z.string(),
    selector: z.string(),
    all: z.boolean().optional(),
    maxElements: z.number().optional()
  }
} as const satisfies ITool<'webpage_query'>;
