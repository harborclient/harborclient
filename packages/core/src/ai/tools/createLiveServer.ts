import { z } from 'zod';
import type { ITool } from './ITool';
import {
  LIVE_SERVER_ALIAS_SCHEMA,
  LIVE_SERVER_CORS_SCHEMA,
  liveServerAliasShape,
  liveServerCorsShape
} from './liveServerSchemas';

/**
 * Arguments for the create_live_server tool.
 */
export interface CreateLiveServerToolArgs {
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
  port?: number | null;

  /**
   * Path aliases to persist.
   */
  aliases?: Array<{ path: string; target: string }>;

  /**
   * Whether file watching is enabled when started.
   */
  watch?: boolean;

  /**
   * CORS settings to persist.
   */
  cors?: {
    enabled?: boolean;
    origin?: string;
    methods?: string;
    allowedHeaders?: string;
    credentials?: boolean;
  };
}

/**
 * Creates a saved live server in the local registry.
 *
 * @param {string} name - Display name for the saved server.
 * @param {string} root - Absolute document root path.
 * @param {number|null} [port] - Explicit port, or null to auto-select.
 * @param {object[]} [aliases] - Path aliases.
 * @param {boolean} [watch] - Whether file watching is enabled when started.
 * @param {object} [cors] - CORS settings.
 */
export const createLiveServerTool = {
  name: 'create_live_server',
  definition: {
    type: 'function',
    function: {
      name: 'create_live_server',
      description:
        'Creates a saved live server config (name, root, port, aliases, watch, cors) in the local registry. Persists immediately but does not start the server. Only call when the user explicitly asks to create or save a live server. root must be an absolute filesystem path.',
      parameters: {
        type: 'object',
        properties: {
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
            description: 'Whether file watching is enabled when started. Defaults to true.'
          },
          cors: {
            ...LIVE_SERVER_CORS_SCHEMA,
            description: 'CORS settings to persist.'
          }
        },
        required: ['name', 'root'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    name: z.string(),
    root: z.string(),
    port: z.number().nullable().optional(),
    aliases: z.array(liveServerAliasShape).optional(),
    watch: z.boolean().optional(),
    cors: liveServerCorsShape.optional()
  }
} as const satisfies ITool<'create_live_server'>;
