import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the webpage_inject_script tool.
 */
export interface WebpageInjectScriptToolArgs {
  /**
   * Browser tab id from webpage_tab.
   */
  tabId: string;

  /**
   * JavaScript source injected into the current page main world.
   */
  source: string;
}

/**
 * Injects a JavaScript source into a browser tab's current page.
 *
 * @param {string} tabId - Browser tab id from webpage_tab.
 * @param {string} source - JavaScript source to inject.
 */
export const webpageInjectScriptTool = {
  name: 'webpage_inject_script',
  definition: {
    type: 'function',
    function: {
      name: 'webpage_inject_script',
      description:
        'Injects and runs JavaScript source in an embedded browser tab page main world. Pass tabId from webpage_tab. Only use when the user asks to inject a script or when a durable script injection is needed; prefer webpage_evaluate for one-off reads or small DOM edits.',
      parameters: {
        type: 'object',
        properties: {
          tabId: {
            type: 'string',
            description: 'Browser tab id from webpage_tab.'
          },
          source: {
            type: 'string',
            description: 'JavaScript source to inject and run in the page.'
          }
        },
        required: ['tabId', 'source'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    tabId: z.string(),
    source: z.string()
  }
} as const satisfies ITool<'webpage_inject_script'>;
