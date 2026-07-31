import { z } from 'zod';
import type { ITool } from './ITool';
import {
  LIVE_SERVER_ALIAS_SCHEMA,
  LIVE_SERVER_CORS_SCHEMA,
  liveServerAliasShape,
  liveServerCorsShape
} from './liveServerSchemas';

/**
 * Arguments for the start_live_server tool.
 */
export interface StartLiveServerToolArgs {
  /**
   * Saved live server database id to start from a persisted config.
   */
  savedId?: number;

  /**
   * Display name when starting with an ad-hoc config (ignored when savedId is set).
   */
  name?: string;

  /**
   * Absolute filesystem root to serve when starting ad-hoc (required without savedId).
   */
  root?: string;

  /**
   * Explicit listen port, or null to auto-select from 5500 upward.
   */
  port?: number | null;

  /**
   * Path aliases mounted before the document root.
   */
  aliases?: Array<{ path: string; target: string }>;

  /**
   * Whether file watching is enabled for this run.
   */
  watch?: boolean;

  /**
   * CORS middleware settings for this run.
   */
  cors?: {
    enabled?: boolean;
    origin?: string;
    methods?: string;
    allowedHeaders?: string;
    credentials?: boolean;
  };

  /**
   * When true (default), opens a browser tab at the server origin after start.
   */
  openBrowser?: boolean;
}

/**
 * Starts a live server from a saved id or an ad-hoc config.
 *
 * @param {number} [savedId] - Saved live server database id.
 * @param {string} [name] - Display name for an ad-hoc start.
 * @param {string} [root] - Absolute root directory for an ad-hoc start.
 * @param {number|null} [port] - Explicit port, or null to auto-select.
 * @param {object[]} [aliases] - Path aliases.
 * @param {boolean} [watch] - Whether file watching is enabled.
 * @param {object} [cors] - CORS settings.
 * @param {boolean} [openBrowser] - Whether to open a browser tab (default true).
 */
export const startLiveServerTool = {
  name: 'start_live_server',
  definition: {
    type: 'function',
    function: {
      name: 'start_live_server',
      description:
        'Starts a live server from a savedId or an ad-hoc config (root required without savedId). Returns runtime id, port, and origin (loopback only). Only call when the user explicitly asks to start a live server. openBrowser defaults to true; pass false to skip opening a browser tab. Config changes on a running server require stop then start.',
      parameters: {
        type: 'object',
        properties: {
          savedId: {
            type: 'number',
            description: 'Saved live server database id to start from a persisted config.'
          },
          name: {
            type: 'string',
            description: 'Display name when starting with an ad-hoc config.'
          },
          root: {
            type: 'string',
            description: 'Absolute filesystem root to serve when starting ad-hoc.'
          },
          port: {
            type: ['number', 'null'],
            description: 'Explicit listen port, or null to auto-select from 5500 upward.'
          },
          aliases: {
            type: 'array',
            items: LIVE_SERVER_ALIAS_SCHEMA,
            description: 'Path aliases mounted before the document root.'
          },
          watch: {
            type: 'boolean',
            description: 'Whether file watching is enabled for this run.'
          },
          cors: {
            ...LIVE_SERVER_CORS_SCHEMA,
            description: 'CORS middleware settings for this run.'
          },
          openBrowser: {
            type: 'boolean',
            description:
              'When true (default), opens a browser tab at the server origin after start.'
          }
        },
        additionalProperties: false
      }
    }
  },
  inputShape: {
    savedId: z.number().optional(),
    name: z.string().optional(),
    root: z.string().optional(),
    port: z.number().nullable().optional(),
    aliases: z.array(liveServerAliasShape).optional(),
    watch: z.boolean().optional(),
    cors: liveServerCorsShape.optional(),
    openBrowser: z.boolean().optional()
  }
} as const satisfies ITool<'start_live_server'>;
