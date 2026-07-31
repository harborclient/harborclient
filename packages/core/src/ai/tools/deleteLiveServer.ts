import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the delete_live_server tool.
 */
export interface DeleteLiveServerToolArgs {
  /**
   * Database primary key of the saved live server to delete.
   */
  id: number;
}

/**
 * Deletes a saved live server from the local registry.
 *
 * @param {number} id - Database primary key of the saved live server to delete.
 */
export const deleteLiveServerTool = {
  name: 'delete_live_server',
  definition: {
    type: 'function',
    function: {
      name: 'delete_live_server',
      description:
        'Deletes a saved live server config from the local registry. Only call when the user explicitly asks to delete a live server. Does not stop a running instance by itself — call stop_live_server first when one is running.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'number',
            description: 'Database primary key of the saved live server to delete.'
          }
        },
        required: ['id'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    id: z.number()
  }
} as const satisfies ITool<'delete_live_server'>;
