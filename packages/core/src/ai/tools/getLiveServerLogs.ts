import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the get_live_server_logs tool.
 */
export interface GetLiveServerLogsToolArgs {
  /**
   * Saved live server database id of a running instance.
   */
  savedId?: number;

  /**
   * Runtime instance id of a running live server.
   */
  id?: string;

  /**
   * Maximum number of recent log lines to return (capped).
   */
  maxLines?: number;
}

/**
 * Returns buffered Express access-log lines for a running live server.
 *
 * @param {number} [savedId] - Saved live server database id.
 * @param {string} [id] - Runtime instance id.
 * @param {number} [maxLines] - Maximum recent lines to return.
 */
export const getLiveServerLogsTool = {
  name: 'get_live_server_logs',
  definition: {
    type: 'function',
    function: {
      name: 'get_live_server_logs',
      description:
        'Returns buffered Express access-log lines for a running live server (method, url, statusCode, durationMs, contentLength, timestamp). Pass savedId or runtime id. Use to diagnose 404s or recent traffic. Returns an empty list when the server is not running.',
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
          },
          maxLines: {
            type: 'number',
            description: 'Maximum number of recent log lines to return (default 100, max 1000).'
          }
        },
        additionalProperties: false
      }
    }
  },
  inputShape: {
    savedId: z.number().optional(),
    id: z.string().optional(),
    maxLines: z.number().optional()
  }
} as const satisfies ITool<'get_live_server_logs'>;
