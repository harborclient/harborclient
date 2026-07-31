import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the get_live_server tool.
 */
export interface GetLiveServerToolArgs {
  /**
   * Saved live server database id.
   */
  id?: number;

  /**
   * Saved live server uuid from an `@live-server` reference.
   */
  uuid?: string;
}

/**
 * Returns one saved live server by id or uuid.
 *
 * @param {number} [id] - Saved live server database id.
 * @param {string} [uuid] - Saved live server uuid from an `@live-server` reference.
 */
export const getLiveServerTool = {
  name: 'get_live_server',
  definition: {
    type: 'function',
    function: {
      name: 'get_live_server',
      description:
        'Returns one saved live server by id or uuid (name, root, port, aliases, watch, cors). Use when the user message contains @live-server.<uuid>. Prefer the returned display name in replies.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'number',
            description: 'Saved live server database id.'
          },
          uuid: {
            type: 'string',
            description: 'Saved live server uuid from an @live-server reference.'
          }
        },
        additionalProperties: false
      }
    }
  },
  inputShape: {
    id: z.number().optional(),
    uuid: z.string().optional()
  }
} as const satisfies ITool<'get_live_server'>;
