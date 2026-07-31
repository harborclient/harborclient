import { z } from 'zod';
import type { ITool } from './ITool';
import {
  LIVE_SERVER_ALIAS_SCHEMA,
  LIVE_SERVER_CORS_SCHEMA,
  LIVE_SERVER_EXPANDED_CONFIG_PROPERTIES,
  liveServerAliasShape,
  liveServerCorsShape,
  liveServerExpandedConfigShape
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
    exposedHeaders?: string;
    maxAge?: string;
    credentials?: boolean;
  };

  /**
   * Entry / open path when the Live Page starts.
   */
  openPath?: string;

  /**
   * Whether to remember the last opened URL within the origin.
   */
  rememberLastUrl?: boolean;

  /**
   * Ordered directory index filenames.
   */
  indexFiles?: string[];

  /**
   * Listen bind host (e.g. `127.0.0.1` or `0.0.0.0`).
   */
  host?: string;

  /**
   * Custom response headers.
   */
  headers?: Array<{ name: string; value: string; enabled?: boolean }>;

  /**
   * Path routing / SPA fallback rules.
   */
  routes?: Array<{ match: string; target: string; enabled?: boolean }>;

  /**
   * HTTPS settings (certificate/key filesystem paths, not PEM contents).
   */
  ssl?: {
    enabled?: boolean;
    certPath?: string;
    keyPath?: string;
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
 * @param {object} [cors] - CORS settings (including exposedHeaders / maxAge).
 * @param {string} [openPath] - Live Page entry path.
 * @param {boolean} [rememberLastUrl] - Whether to persist last navigated path.
 * @param {string[]} [indexFiles] - Directory index filenames.
 * @param {string} [host] - Listen bind host.
 * @param {object[]} [headers] - Custom response headers.
 * @param {object[]} [routes] - Path routing / SPA fallback rules.
 * @param {object} [ssl] - HTTPS cert/key paths.
 */
export const createLiveServerTool = {
  name: 'create_live_server',
  definition: {
    type: 'function',
    function: {
      name: 'create_live_server',
      description:
        'Creates a saved live server config (name, root, port, aliases, watch, cors, openPath, rememberLastUrl, indexFiles, host, headers, routes, ssl) in the local registry. Persists immediately but does not start the server. Only call when the user explicitly asks to create or save a live server. root must be an absolute filesystem path. Routing rules run after static miss (use match `*` + target `index.html` for SPA fallback). SSL uses absolute cert/key file paths — HarborClient does not generate certificates. lastOpenedPath is not set by this tool (navigation preference state).',
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
            description: 'CORS settings to persist (including exposedHeaders and maxAge).'
          },
          ...LIVE_SERVER_EXPANDED_CONFIG_PROPERTIES
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
    cors: liveServerCorsShape.optional(),
    ...liveServerExpandedConfigShape
  }
} as const satisfies ITool<'create_live_server'>;
