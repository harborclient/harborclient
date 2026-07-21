import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Returns one saved request by uuid with method, url, headers, params, body, auth, and scripts.
 *
 * @param {string} uuid - Saved request uuid from the @request reference.
 */
export const getRequestTool = {
  name: 'get_request',
  definition: {
    type: 'function',
    function: {
      name: 'get_request',
      description:
        'Returns one saved request by uuid with method, url, headers, params, body, auth, and scripts. Use when the user message contains @request.<uuid>. Use the uuid only for this tool call; refer to the request by its returned name in replies.',
      parameters: {
        type: 'object',
        properties: {
          uuid: { type: 'string', description: 'Saved request uuid from the @request reference.' }
        },
        required: ['uuid'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    uuid: z.string()
  }
} as const satisfies ITool<'get_request'>;
