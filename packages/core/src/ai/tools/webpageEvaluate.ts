import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the webpage_evaluate tool.
 */
export interface WebpageEvaluateToolArgs {
  /**
   * Browser tab id from webpage_tab.
   */
  tabId: string;

  /**
   * JavaScript expression or statement list evaluated in the page main world.
   * Should return a JSON-serializable value.
   */
  expression: string;
}

/**
 * Evaluates JavaScript in a browser tab's page (read or mutate DOM).
 *
 * @param {string} tabId - Browser tab id from webpage_tab.
 * @param {string} expression - JavaScript to run in the page; return a JSON-serializable value.
 */
export const webpageEvaluateTool = {
  name: 'webpage_evaluate',
  definition: {
    type: 'function',
    function: {
      name: 'webpage_evaluate',
      description:
        'Evaluates JavaScript in an embedded browser tab page main world and returns the result. Pass tabId from webpage_tab. Prefer webpage_query for CSS selector reads. Use this to compute derived values or to modify the DOM when the user asks. The expression should return a JSON-serializable value (wrap complex logic in an IIFE).',
      parameters: {
        type: 'object',
        properties: {
          tabId: {
            type: 'string',
            description: 'Browser tab id from webpage_tab.'
          },
          expression: {
            type: 'string',
            description:
              'JavaScript to evaluate in the page. Prefer an IIFE that returns a JSON-serializable value.'
          }
        },
        required: ['tabId', 'expression'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    tabId: z.string(),
    expression: z.string()
  }
} as const satisfies ITool<'webpage_evaluate'>;
