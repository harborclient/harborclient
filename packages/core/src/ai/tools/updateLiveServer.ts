import { z } from 'zod';
import type { ITool } from './ITool';
import {
  LIVE_SERVER_ALIAS_SCHEMA,
  LIVE_SERVER_CORS_SCHEMA,
  liveServerAliasShape,
  liveServerCorsShape
} from './liveServerSchemas';

/**
 * Arguments for the update_live_server tool.
 */
export interface UpdateLiveServerToolArgs {
  /**
   * Database primary key of the server to update.
   */
  id: number;

  /**
   * Display name for the saved server.
   */
  name: string;

  /**
   * Absolute path to the directory served as the document root.
   */
  root: string;

  /**
   * Explicit listen port, or null to auto-select.
   */
  port: number | null;

  /**
   * Path aliases to persist.
   */
  aliases: Array<{ path: string; target: string }>;

  /**
   * Whether file watching is enabled when started.
   */
  watch: boolean;

  /**
   * CORS settings to persist.
   */
  cors: {
    enabled?: boolean;
    origin?: string;
    methods?: string;
    allowedHeaders?: string;
    credentials?: boolean;
  };
}

/**
 * Updates a saved live server in the local registry.
 *
 * @param {number} id - Database primary key of the server to update.
 * @param {string} name - Display name for the saved server.
 * @param {string} root - Absolute document root path.
 * @param {number|null} port - Explicit port, or null to auto-select.
 * @param {object[]} aliases - Path aliases.
 * @param {boolean} watch - Whether file watching is enabled when started.
 * @param {object} cors - CORS settings.
 */
export const updateLiveServerTool = {
  name: 'update_live_server',
  definition: {
    type: 'function',
    function: {
      name: 'update_live_server',
      description:
        'Updates a saved live server config (name, root, port, aliases, watch, cors). Persists immediately but does not restart a running instance — call stop_live_server then start_live_server when the user wants the new config applied. Only call when the user explicitly asks to change a live server.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'number',
            description: 'Database primary key of the server to update.'
          },
          name: { type: 'string', description: 'Display name for the saved server.' },
          root: {
            type: 'string',
            description: 'Absolute path to the directory served as the document root.'
          },
          port: {
            type: ['number', 'null'],
            description: 'Explicit listen port, or null to auto-select.'
          },
          aliases: {
            type: 'array',
            items: LIVE_SERVER_ALIAS_SCHEMA,
            description: 'Path aliases to persist.'
          },
          watch: {
            type: 'boolean',
            description: 'Whether file watching is enabled when started.'
          },
          cors: {
            ...LIVE_SERVER_CORS_SCHEMA,
            description: 'CORS settings to persist.'
          }
        },
        required: ['id', 'name', 'root', 'port', 'aliases', 'watch', 'cors'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    id: z.number(),
    name: z.string(),
    root: z.string(),
    port: z.number().nullable(),
    aliases: z.array(liveServerAliasShape),
    watch: z.boolean(),
    cors: liveServerCorsShape
  }
} as const satisfies ITool<'update_live_server'>;
