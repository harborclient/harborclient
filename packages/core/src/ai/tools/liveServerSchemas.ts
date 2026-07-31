import { z } from 'zod';

/**
 * JSON schema for a live-server URL-path-to-filesystem alias.
 */
export const LIVE_SERVER_ALIAS_SCHEMA = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'URL path prefix, e.g. `/assets`.'
    },
    target: {
      type: 'string',
      description: 'Filesystem target, absolute or relative to the server root.'
    }
  },
  required: ['path', 'target'],
  additionalProperties: false
} as const;

/**
 * JSON schema for live-server CORS middleware settings.
 */
export const LIVE_SERVER_CORS_SCHEMA = {
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      description: 'When true, CORS middleware is mounted.'
    },
    origin: {
      type: 'string',
      description: 'Allowed origin(s): `*` or a comma-separated list.'
    },
    methods: {
      type: 'string',
      description: 'Allowed methods: `*` or a comma-separated list (e.g. `GET,POST`).'
    },
    allowedHeaders: {
      type: 'string',
      description: 'Allowed request headers: `*`, empty, or comma-separated names.'
    },
    credentials: {
      type: 'boolean',
      description: 'When true, responses include Access-Control-Allow-Credentials.'
    }
  },
  additionalProperties: false
} as const;

/**
 * Zod schema for a live-server path alias in MCP tool arguments.
 */
export const liveServerAliasShape = z.object({
  path: z.string(),
  target: z.string()
});

/**
 * Zod schema for live-server CORS settings in MCP tool arguments.
 */
export const liveServerCorsShape = z.object({
  enabled: z.boolean().optional(),
  origin: z.string().optional(),
  methods: z.string().optional(),
  allowedHeaders: z.string().optional(),
  credentials: z.boolean().optional()
});
