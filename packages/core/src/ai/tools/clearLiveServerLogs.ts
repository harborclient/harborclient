import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the clear_live_server_logs tool.
 */
export interface ClearLiveServerLogsToolArgs {
  /**
   * Saved live server database id of a running instance.
   */
  savedId?: number;

  /**
   * Runtime instance id of a running live server.
   */
  id?: string;
}

/**
 * Clears the in-memory access-log buffer for a running live server.
 *
 * @param {number} [savedId] - Saved live server database id.
 * @param {string} [id] - Runtime instance id.
 */
export const clearLiveServerLogsTool = {
  name: 'clear_live_server_logs',
  definition: {
    type: 'function',
    function: {
      name: 'clear_live_server_logs',
      description:
        'Clears the in-memory Express access-log buffer for a running live server. Pass savedId or runtime id. Only call when the user explicitly asks to clear live server logs.',
      parameters: {
        type: 'object',
        properties: {
          savedId: {
            type: 'number',
            description: 'Saved live server database id of a running instance.'
          },
          id: {
            type: 'string',
            description: 'Runtime instance id of a running live server.'
          }
        },
        additionalProperties: false
      }
    }
  },
  inputShape: {
    savedId: z.number().optional(),
    id: z.string().optional()
  }
} as const satisfies ITool<'clear_live_server_logs'>;
