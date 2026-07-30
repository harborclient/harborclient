import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the webpage_inject_stylesheet tool.
 */
export interface WebpageInjectStylesheetToolArgs {
  /**
   * Browser tab id from webpage_tab.
   */
  tabId: string;

  /**
   * CSS stylesheet source to insert into the page.
   */
  css: string;
}

/**
 * Injects a CSS stylesheet into a browser tab's current page.
 *
 * @param {string} tabId - Browser tab id from webpage_tab.
 * @param {string} css - Stylesheet source.
 */
export const webpageInjectStylesheetTool = {
  name: 'webpage_inject_stylesheet',
  definition: {
    type: 'function',
    function: {
      name: 'webpage_inject_stylesheet',
      description:
        'Inserts a CSS stylesheet into an embedded browser tab page. Pass tabId from webpage_tab. Only use when the user asks to inject styles or change page appearance.',
      parameters: {
        type: 'object',
        properties: {
          tabId: {
            type: 'string',
            description: 'Browser tab id from webpage_tab.'
          },
          css: {
            type: 'string',
            description: 'CSS stylesheet source to insert into the page.'
          }
        },
        required: ['tabId', 'css'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    tabId: z.string(),
    css: z.string()
  }
} as const satisfies ITool<'webpage_inject_stylesheet'>;
