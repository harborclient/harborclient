import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the get_active_response tool.
 */
export interface GetActiveResponseToolArgs {
  /**
   * Maximum response body characters to return; defaults to 16384.
   */
  maxBodyChars?: number;
}

/**
 * Returns the last HTTP response for the active tab with a capped body, or null.
 *
 * @param {number} [maxBodyChars] - Maximum response body characters to return; defaults to 16384.
 */
export const getActiveResponseTool = {
  name: 'get_active_response',
  definition: {
    type: 'function',
    function: {
      name: 'get_active_response',
      description:
        'Returns the last HTTP response for the active tab with a capped body (status, headers, body, tests), or null. Use get_active_response_summary first; pass maxBodyChars only when more body text is needed.',
      parameters: {
        type: 'object',
        properties: {
          maxBodyChars: {
            type: 'number',
            description: 'Maximum response body characters to return; defaults to 16384.'
          }
        },
        additionalProperties: false
      }
    }
  },
  inputShape: {
    maxBodyChars: z.number().optional()
  }
} as const satisfies ITool<'get_active_response'>;
