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
    exposedHeaders?: string;
    maxAge?: string;
    credentials?: boolean;
  };

  /**
   * Entry / open path when the Live Page starts. When omitted, the existing value is kept.
   */
  openPath?: string;

  /**
   * Whether to remember the last opened URL. When omitted, the existing value is kept.
   */
  rememberLastUrl?: boolean;

  /**
   * Ordered directory index filenames. When omitted, the existing value is kept.
   */
  indexFiles?: string[];

  /**
   * Listen bind host. When omitted, the existing value is kept.
   */
  host?: string;

  /**
   * Custom response headers. When omitted, the existing value is kept.
   */
  headers?: Array<{ name: string; value: string; enabled?: boolean }>;

  /**
   * Path routing rules. When omitted, the existing value is kept.
   */
  routes?: Array<{ match: string; target: string; enabled?: boolean }>;

  /**
   * Reverse-proxy rules. When omitted, the existing value is kept.
   */
  proxies?: Array<{
    path: string;
    target: string;
    stripPath?: boolean;
    enabled?: boolean;
  }>;

  /**
   * HTTPS settings. When omitted, the existing value is kept.
   */
  ssl?: {
    enabled?: boolean;
    certPath?: string;
    keyPath?: string;
  };

  /**
   * Companion process command. When omitted, the existing value is kept.
   */
  runCommand?: string;

  /**
   * Restart-on-crash flag. When omitted, the existing value is kept.
   */
  restartOnCrash?: boolean;

  /**
   * Global variable name set to the server origin URL on start. When omitted, kept.
   */
  urlVariable?: string;
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
 * @param {object} cors - CORS settings (including exposedHeaders / maxAge).
 * @param {string} [openPath] - Live Page entry path.
 * @param {boolean} [rememberLastUrl] - Whether to persist last navigated path.
 * @param {string[]} [indexFiles] - Directory index filenames.
 * @param {string} [host] - Listen bind host.
 * @param {object[]} [headers] - Custom response headers.
 * @param {object[]} [routes] - Path routing / SPA fallback rules.
 * @param {object[]} [proxies] - Reverse-proxy path-prefix rules.
 * @param {object} [ssl] - HTTPS cert/key paths.
 * @param {string} [runCommand] - Companion process command.
 * @param {boolean} [restartOnCrash] - Restart companion after unexpected crash.
 * @param {string} [urlVariable] - Global variable name set to the server origin URL on start.
 */
export const updateLiveServerTool = {
  name: 'update_live_server',
  definition: {
    type: 'function',
    function: {
      name: 'update_live_server',
      description:
        'Updates a saved live server config (name, root, port, aliases, watch, cors, openPath, rememberLastUrl, indexFiles, host, headers, routes, proxies, ssl, runCommand, restartOnCrash, urlVariable). Expanded fields (openPath, host, headers, routes, proxies, ssl, runCommand, restartOnCrash, urlVariable, …) are optional — omit them to keep existing values. Persists immediately but does not restart a running instance — call stop_live_server then start_live_server when the user wants the new config applied. Only call when the user explicitly asks to change a live server. lastOpenedPath is not set by this tool.',
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
            description: 'CORS settings to persist (including exposedHeaders and maxAge).'
          },
          ...LIVE_SERVER_EXPANDED_CONFIG_PROPERTIES
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
    cors: liveServerCorsShape,
    ...liveServerExpandedConfigShape
  }
} as const satisfies ITool<'update_live_server'>;
