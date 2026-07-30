import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the webpage_tab tool.
 */
export interface WebpageTabToolArgs {
  /**
   * When set, returns an open browser tab with this URL if one exists;
   * otherwise opens a new browser tab at this URL.
   * When omitted, returns info for the active browser tab.
   */
  url?: string;
}

/**
 * Opens a new embedded browser tab at a URL, reuses a matching tab, or returns the active tab.
 *
 * @param {string} [url] - URL to find or open; omit to inspect the active browser tab.
 */
export const webpageTabTool = {
  name: 'webpage_tab',
  definition: {
    type: 'function',
    function: {
      name: 'webpage_tab',
      description:
        'Returns info about an embedded HarborClient browser (webpage) tab, including a dom descriptor for follow-up tools. Call with no url to inspect the active browser tab. Call with a url to reuse an already-open browser tab at that address when one exists; otherwise open a new tab (http/https), wait for load, and return its info. Use the returned dom.tabId with webpage_query, webpage_evaluate, webpage_inject_script, and webpage_inject_stylesheet.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description:
              'URL to find among open browser tabs or open in a new tab. Omit to return the currently active browser tab.'
          }
        },
        additionalProperties: false
      }
    }
  },
  inputShape: {
    url: z.string().optional()
  }
} as const satisfies ITool<'webpage_tab'>;
