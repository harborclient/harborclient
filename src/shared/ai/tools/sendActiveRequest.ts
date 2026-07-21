import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the send_active_request tool.
 */
export interface SendActiveRequestToolArgs {
  /**
   * When provided and greater than zero, includes a capped response body; otherwise only a summary preview is returned.
   */
  maxBodyChars?: number;
}

/**
 * Sends the HTTP request in the active editor tab and returns a compact response summary by default.
 *
 * @param {number} [maxBodyChars] - When greater than zero, includes a capped response body.
 */
export const sendActiveRequestTool = {
  name: 'send_active_request',
  definition: {
    type: 'function',
    function: {
      name: 'send_active_request',
      description:
        'Sends the HTTP request in the active editor tab (equivalent to clicking Send). Returns a compact response summary by default (status, headers, short body preview, tests). Pass maxBodyChars only when you need a capped full body in the same turn; otherwise call get_active_response afterward.',
      parameters: {
        type: 'object',
        properties: {
          maxBodyChars: {
            type: 'number',
            description:
              'Optional. When provided and greater than zero, includes a capped response body; otherwise only a summary preview is returned.'
          }
        },
        additionalProperties: false
      }
    }
  },
  inputShape: {
    maxBodyChars: z.number().optional()
  }
} as const satisfies ITool<'send_active_request'>;
