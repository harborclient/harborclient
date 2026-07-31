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
    exposedHeaders?: string;
    maxAge?: string;
    credentials?: boolean;
  };

  /**
   * Entry / open path when the Live Page starts (ad-hoc only).
   */
  openPath?: string;

  /**
   * Whether to remember the last opened URL (ad-hoc only; rarely useful without savedId).
   */
  rememberLastUrl?: boolean;

  /**
   * Ordered directory index filenames (ad-hoc only).
   */
  indexFiles?: string[];

  /**
   * Listen bind host (ad-hoc only).
   */
  host?: string;

  /**
   * Custom response headers (ad-hoc only).
   */
  headers?: Array<{ name: string; value: string; enabled?: boolean }>;

  /**
   * Path routing / SPA fallback rules (ad-hoc only).
   */
  routes?: Array<{ match: string; target: string; enabled?: boolean }>;

  /**
   * Reverse-proxy rules (ad-hoc only).
   */
  proxies?: Array<{
    path: string;
    target: string;
    stripPath?: boolean;
    enabled?: boolean;
  }>;

  /**
   * HTTPS settings for this run (ad-hoc only).
   */
  ssl?: {
    enabled?: boolean;
    certPath?: string;
    keyPath?: string;
  };

  /**
   * Companion process command for this run (ad-hoc only).
   */
  runCommand?: string;

  /**
   * Restart companion after unexpected crash (ad-hoc only).
   */
  restartOnCrash?: boolean;

  /**
   * Global variable name set to the server origin URL on start (ad-hoc only).
   */
  urlVariable?: string;

  /**
   * When true (default), opens a browser tab at the resolved open URL after start.
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
 * @param {string} [openPath] - Live Page entry path (ad-hoc).
 * @param {boolean} [rememberLastUrl] - Remember-last-URL flag (ad-hoc).
 * @param {string[]} [indexFiles] - Directory index filenames (ad-hoc).
 * @param {string} [host] - Listen bind host (ad-hoc).
 * @param {object[]} [headers] - Custom response headers (ad-hoc).
 * @param {object[]} [routes] - Path routing rules (ad-hoc).
 * @param {object[]} [proxies] - Reverse-proxy path-prefix rules (ad-hoc).
 * @param {object} [ssl] - HTTPS cert/key paths (ad-hoc).
 * @param {string} [runCommand] - Companion process command (ad-hoc).
 * @param {boolean} [restartOnCrash] - Restart companion after unexpected crash (ad-hoc).
 * @param {string} [urlVariable] - Global variable name set to the server origin URL on start (ad-hoc).
 * @param {boolean} [openBrowser] - Whether to open a browser tab (default true).
 */
export const startLiveServerTool = {
  name: 'start_live_server',
  definition: {
    type: 'function',
    function: {
      name: 'start_live_server',
      description:
        'Starts a live server from a savedId or an ad-hoc config (root required without savedId). Ad-hoc starts accept openPath, rememberLastUrl, indexFiles, host, headers, routes, proxies, ssl (cert/key file paths), runCommand, restartOnCrash, and urlVariable. Returns runtime id, port, and origin (loopback-friendly when bound to 0.0.0.0). Only call when the user explicitly asks to start a live server. openBrowser defaults to true; pass false to skip opening a browser tab. Config changes on a running server require stop then start.',
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
          ...LIVE_SERVER_EXPANDED_CONFIG_PROPERTIES,
          openBrowser: {
            type: 'boolean',
            description:
              'When true (default), opens a browser tab at the resolved open URL after start.'
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
    ...liveServerExpandedConfigShape,
    openBrowser: z.boolean().optional()
  }
} as const satisfies ITool<'start_live_server'>;
