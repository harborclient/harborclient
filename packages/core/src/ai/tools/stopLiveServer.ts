import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the stop_live_server tool.
 */
export interface StopLiveServerToolArgs {
  /**
   * Runtime instance id of the running live server.
   */
  id?: string;

  /**
   * Saved live server database id of a running instance.
   */
  savedId?: number;
}

/**
 * Stops a running live server by runtime id or saved id.
 *
 * @param {string} [id] - Runtime instance id.
 * @param {number} [savedId] - Saved live server database id.
 */
export const stopLiveServerTool = {
  name: 'stop_live_server',
  definition: {
    type: 'function',
    function: {
      name: 'stop_live_server',
      description:
        'Stops a running live server by runtime id or savedId. Only call when the user explicitly asks to stop a live server.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Runtime instance id of the running live server.'
          },
          savedId: {
            type: 'number',
            description: 'Saved live server database id of a running instance.'
          }
        },
        additionalProperties: false
      }
    }
  },
  inputShape: {
    id: z.string().optional(),
    savedId: z.number().optional()
  }
} as const satisfies ITool<'stop_live_server'>;
