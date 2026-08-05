import { z } from 'zod';

/**
 * JSON schema for selecting the storage provider used by a saved live server.
 */
export const LIVE_SERVER_CONNECTION_ID_SCHEMA = {
  type: 'string',
  description:
    'Storage connection id for the saved live server. Omit to use the active data provider.'
} as const;

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
 * JSON schema for one custom live-server response header row.
 */
export const LIVE_SERVER_HEADER_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Header name, e.g. `Cache-Control`.'
    },
    value: {
      type: 'string',
      description: 'Header value, e.g. `no-store`.'
    },
    enabled: {
      type: 'boolean',
      description: 'When false, the header is not applied. Defaults to true.'
    }
  },
  required: ['name', 'value'],
  additionalProperties: false
} as const;

/**
 * JSON schema for one live-server path routing rule (SPA fallback / soft rewrite).
 */
export const LIVE_SERVER_ROUTE_SCHEMA = {
  type: 'object',
  properties: {
    match: {
      type: 'string',
      description:
        '`*` for every path, or a regex source matched against the URL pathname (e.g. `^/docs/`). Regex sources are limited to 256 characters and must not use nested quantifiers that enable catastrophic backtracking.'
    },
    target: {
      type: 'string',
      description:
        'File or directory path, absolute or relative to the server root (e.g. `index.html`).'
    },
    enabled: {
      type: 'boolean',
      description: 'When false, the rule is ignored. Defaults to true.'
    }
  },
  required: ['match', 'target'],
  additionalProperties: false
} as const;

/**
 * JSON schema for one live-server custom error page (status code → HTML file).
 */
export const LIVE_SERVER_ERROR_PAGE_SCHEMA = {
  type: 'object',
  properties: {
    code: {
      type: 'string',
      description:
        'Status pattern: exact (`404`), decade (`40x` for 400–409), or class (`4xx` for 400–499). The letter `x` is case-insensitive.'
    },
    path: {
      type: 'string',
      description: 'HTML file path, absolute or relative to the server root (e.g. `404.html`).'
    },
    enabled: {
      type: 'boolean',
      description: 'When false, the mapping is ignored. Defaults to true.'
    }
  },
  required: ['code', 'path'],
  additionalProperties: false
} as const;

/**
 * JSON schema for one live-server reverse-proxy rule (path prefix → upstream).
 */
export const LIVE_SERVER_PROXY_SCHEMA = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'URL path prefix, e.g. `/api`. Use `/` or `*` for a catch-all (stored as `/`).'
    },
    target: {
      type: 'string',
      description:
        'Upstream absolute `http://` or `https://` URL, optionally with a base path (e.g. `http://127.0.0.1:3000/v1`).'
    },
    stripPath: {
      type: 'boolean',
      description:
        'When true (default), strip the matched prefix before forwarding to the upstream.'
    },
    enabled: {
      type: 'boolean',
      description: 'When false, the rule is ignored. Defaults to true.'
    }
  },
  required: ['path', 'target'],
  additionalProperties: false
} as const;

/**
 * JSON schema for live-server HTTPS certificate paths (not PEM contents).
 */
export const LIVE_SERVER_SSL_SCHEMA = {
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      description: 'When true, listen with HTTPS using certPath/keyPath.'
    },
    certPath: {
      type: 'string',
      description: 'Absolute path to a PEM (or compatible) certificate file.'
    },
    keyPath: {
      type: 'string',
      description: 'Absolute path to a PEM (or compatible) private key file.'
    }
  },
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
      description:
        'When true, CORS middleware is mounted. Defaults to false (opt-in) for new servers.'
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
    exposedHeaders: {
      type: 'string',
      description:
        'Headers browsers may read: `*`, empty (omit / package default), or comma-separated names.'
    },
    maxAge: {
      type: 'string',
      description:
        'Preflight cache duration in seconds as a string (e.g. `600`). Empty omits Access-Control-Max-Age.'
    },
    credentials: {
      type: 'boolean',
      description: 'When true, responses include Access-Control-Allow-Credentials.'
    }
  },
  additionalProperties: false
} as const;

/**
 * JSON schema properties shared by create/update/start for expanded live-server knobs.
 *
 * Omits `lastOpenedPath` (navigation preference state; not typically set by tools).
 */
export const LIVE_SERVER_EXPANDED_CONFIG_PROPERTIES = {
  openPath: {
    type: 'string',
    description:
      'Path or file opened when the Live Page starts (e.g. `/` or `/docs/`). Defaults to `/`.'
  },
  openPathOnStartup: {
    type: 'boolean',
    description:
      'When true (default), open a Live Page at the start path when the server starts. When false, the server starts without opening a browser tab.'
  },
  rememberLastUrl: {
    type: 'boolean',
    description:
      'When true, Live Page navigations within the origin update the remembered last path.'
  },
  indexFiles: {
    type: 'array',
    items: { type: 'string' },
    description:
      'Ordered directory index filenames (e.g. `["index.html","app.html"]`). Defaults to `["index.html"]`.'
  },
  host: {
    type: 'string',
    description:
      'Listen bind host. Defaults to `127.0.0.1`. Use `0.0.0.0` to expose on the LAN (security risk).'
  },
  headers: {
    type: 'array',
    items: LIVE_SERVER_HEADER_SCHEMA,
    description:
      'Custom response headers (e.g. Cache-Control, CSP). Applied after CORS for all responses.'
  },
  routes: {
    type: 'array',
    items: LIVE_SERVER_ROUTE_SCHEMA,
    description:
      'Ordered path routing rules applied after static miss (first match wins). Use match `*` and target `index.html` for SPA history fallback.'
  },
  errorPages: {
    type: 'array',
    items: LIVE_SERVER_ERROR_PAGE_SCHEMA,
    description:
      'Custom HTML error pages for status ≥ 400. Codes may be exact (`404`), decade (`40x`), or class (`4xx`). Most specific match wins.'
  },
  proxies: {
    type: 'array',
    items: LIVE_SERVER_PROXY_SCHEMA,
    description:
      'Ordered reverse-proxy rules applied before static (first match wins). Path prefix e.g. `/api` → absolute `http(s)://` target. WebSockets are not forwarded.'
  },
  ssl: {
    ...LIVE_SERVER_SSL_SCHEMA,
    description:
      'HTTPS settings. Supply absolute certPath/keyPath when enabled; HarborClient does not generate certificates.'
  },
  runCommand: {
    type: 'string',
    description:
      'Optional companion process command. When runtimeId is set this is arguments only (e.g. `server.js -p 3000`); when runtimeId is empty this is the full command (absolute binary + args, e.g. `/usr/bin/node ./server.js`). Spawned without a shell; cwd is the document root. Empty means none.'
  },
  runtimeId: {
    type: 'string',
    description:
      'Optional id of a machine-local runtime from Settings → Runtimes. Empty means None (run the command string directly).'
  },
  runCommandEnv: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: { type: 'string' },
        enabled: { type: 'boolean' }
      }
    },
    description:
      'Optional environment variables for the companion process. Values may include `{{variables}}`. Rows override matching keys from the selected runtime. Defaults to `[]`.'
  },
  runCommandEnabled: {
    type: 'boolean',
    description:
      'When true, start the companion process with the live server. When omitted, enabled if runCommand or runtimeId is set. Defaults to false for new servers with no command.'
  },
  restartOnCrash: {
    type: 'boolean',
    description:
      'When true and a run command or runtime is set, restart the companion after an unexpected non-zero exit or signal (not on Stop or clean exit 0). Defaults to false.'
  },
  urlVariable: {
    type: 'string',
    description:
      'Optional global variable name set to the server origin URL (e.g. `http://localhost:5500`) when the server starts. Empty means none. Use as `{{ server_url }}` in requests.'
  },
  preRequestScripts: {
    type: 'array',
    items: { type: 'object' },
    description:
      'Optional pre-request scripts keyed by path-match patterns (`matchPath`, plus inline/snippet script ref fields). Defaults to `[]`.'
  },
  postRequestScripts: {
    type: 'array',
    items: { type: 'object' },
    description:
      'Optional post-request scripts keyed by path-match patterns (`matchPath`, plus inline/snippet script ref fields). Defaults to `[]`.'
  }
} as const;

/**
 * Zod schema for a live-server path alias in MCP tool arguments.
 */
export const liveServerAliasShape = z.object({
  path: z.string(),
  target: z.string()
});

/**
 * Zod schema for a live-server response header row in MCP tool arguments.
 */
export const liveServerHeaderShape = z.object({
  name: z.string(),
  value: z.string(),
  enabled: z.boolean().optional()
});

/**
 * Zod schema for a live-server routing rule in MCP tool arguments.
 */
export const liveServerRouteShape = z.object({
  match: z.string(),
  target: z.string(),
  enabled: z.boolean().optional()
});

/**
 * Zod schema for a live-server error-page row in MCP tool arguments.
 */
export const liveServerErrorPageShape = z.object({
  code: z.string(),
  path: z.string(),
  enabled: z.boolean().optional()
});

/**
 * Zod schema for a live-server reverse-proxy rule in MCP tool arguments.
 */
export const liveServerProxyShape = z.object({
  path: z.string(),
  target: z.string(),
  stripPath: z.boolean().optional(),
  enabled: z.boolean().optional()
});

/**
 * Zod schema for live-server SSL settings in MCP tool arguments.
 */
export const liveServerSslShape = z.object({
  enabled: z.boolean().optional(),
  certPath: z.string().optional(),
  keyPath: z.string().optional()
});

/**
 * Zod schema for live-server CORS settings in MCP tool arguments.
 */
export const liveServerCorsShape = z.object({
  enabled: z.boolean().optional(),
  origin: z.string().optional(),
  methods: z.string().optional(),
  allowedHeaders: z.string().optional(),
  exposedHeaders: z.string().optional(),
  maxAge: z.string().optional(),
  credentials: z.boolean().optional()
});

/**
 * Zod schema for an optional live-server storage connection id.
 */
export const liveServerConnectionIdShape = z.string().trim().min(1);

/**
 * Zod raw shape for expanded live-server config fields shared by create/update/start.
 */
export const liveServerExpandedConfigShape = {
  openPath: z.string().optional(),
  openPathOnStartup: z.boolean().optional(),
  rememberLastUrl: z.boolean().optional(),
  indexFiles: z.array(z.string()).optional(),
  host: z.string().optional(),
  headers: z.array(liveServerHeaderShape).optional(),
  routes: z.array(liveServerRouteShape).optional(),
  errorPages: z.array(liveServerErrorPageShape).optional(),
  proxies: z.array(liveServerProxyShape).optional(),
  ssl: liveServerSslShape.optional(),
  runCommand: z.string().optional(),
  runtimeId: z.string().optional(),
  runCommandEnv: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
        enabled: z.boolean()
      })
    )
    .optional(),
  runCommandEnabled: z.boolean().optional(),
  restartOnCrash: z.boolean().optional(),
  urlVariable: z.string().optional(),
  preRequestScripts: z.array(z.record(z.string(), z.unknown())).optional(),
  postRequestScripts: z.array(z.record(z.string(), z.unknown())).optional()
} as const;
