import { z } from 'zod';
import type { TeamHubAuthConfig } from './auth.js';
import type {
  CollectionRecord,
  DocumentRecord,
  EnvironmentRecord,
  FolderRecord,
  HealthResponse,
  HubUserRecord,
  LivePageRecord,
  LiveServerRecord,
  RunResultDetail,
  RunResultRecord,
  SavedRequestRecord,
  SessionResponse,
  SnippetRecord,
  SnippetScope
} from './types.js';
import type { BodyType, HttpMethod, KeyValue, RequestProtocol, Variable } from './appTypes.js';

/**
 * Supported HTTP methods for saved and live requests.
 */
export const httpMethod = z.enum([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
]) satisfies z.ZodType<HttpMethod>;

/**
 * Transport protocol for saved requests (`http` or `sse`).
 */
export const requestProtocol = z.enum(['http', 'sse']).default('http') satisfies z.ZodType<
  RequestProtocol | undefined
>;

/**
 * Supported request body content types.
 */
export const bodyType = z.enum([
  'none',
  'json',
  'text',
  'multipart',
  'urlencoded'
]) satisfies z.ZodType<BodyType>;

/**
 * Header or query parameter key-value row.
 */
export const keyValue = z.object({
  key: z.string(),
  value: z.string(),
  enabled: z.boolean()
}) satisfies z.ZodType<KeyValue>;

/**
 * Collection or environment variable row.
 */
export const variable = z.object({
  key: z.string(),
  value: z.string(),
  defaultValue: z.string(),
  enabled: z.boolean().optional().default(true),
  share: z.boolean()
}) satisfies z.ZodType<Variable>;

/**
 * Authorization settings returned by Team Hub entity routes.
 */
export const teamHubAuthConfigSchema = z.object({
  type: z.enum(['none', 'basic', 'bearer']),
  basic: z.object({
    username: z.string(),
    password: z.string()
  }),
  bearer: z.object({
    token: z.string()
  })
}) satisfies z.ZodType<TeamHubAuthConfig>;

/**
 * Standard error body returned by HarborClient Server API routes.
 */
export const errorResponseSchema = z.object({
  error: z.string()
});

/**
 * ISO 8601 timestamp strings returned in JSON responses.
 */
export const timestampSchema = z.iso.datetime();

/**
 * Parses deletion lock flags from Team Hub responses.
 *
 * Older hub versions omit this field; treat missing values as unlocked.
 */
export const deletionLockedSchema = z.boolean().optional().default(false);

/**
 * Optional sidebar marker token returned by Team Hub entity routes.
 *
 * Older hub versions omit this field; treat missing values as no marker.
 */
export const sidebarMarkerSchema = z.union([z.string(), z.null()]).optional();

/**
 * JSON shape for a persisted collection record.
 */
export const collectionRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  variables: z.array(variable),
  headers: z.array(keyValue),
  auth: teamHubAuthConfigSchema,
  preRequestScript: z.string(),
  postRequestScript: z.string(),
  createdAt: timestampSchema,
  deletionLocked: deletionLockedSchema,
  marker: sidebarMarkerSchema
}) satisfies z.ZodType<CollectionRecord>;

/**
 * JSON shape for a persisted environment record.
 */
export const environmentRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  variables: z.array(variable),
  createdAt: timestampSchema,
  deletionLocked: deletionLockedSchema,
  marker: sidebarMarkerSchema,
  /**
   * Absent on hub servers that predate environment inheritance; those are roots.
   */
  parentUuid: z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => value ?? null)
}) satisfies z.ZodType<EnvironmentRecord>;

/**
 * Script phases where a snippet may be referenced.
 */
export const snippetScopeSchema = z.enum([
  'pre-request',
  'post-request',
  'any'
]) satisfies z.ZodType<SnippetScope>;

/**
 * Request body for creating a snippet.
 */
export const createSnippetBodySchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().optional(),
  scope: snippetScopeSchema.optional()
});

/**
 * JSON shape for a persisted snippet record.
 */
export const snippetRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  scope: snippetScopeSchema,
  sortOrder: z.number().int(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  createdByUserId: z.string().nullable(),
  updatedByUserId: z.string().nullable(),
  deletionLocked: deletionLockedSchema
}) satisfies z.ZodType<SnippetRecord>;

/**
 * URL alias stored with a live server.
 */
export const liveServerAliasSchema = z.object({
  path: z.string(),
  target: z.string()
});

/**
 * Named live server header row.
 */
export const liveServerHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
  enabled: z.boolean().optional()
});

/**
 * Static route rewrite stored with a live server.
 */
export const liveServerRouteSchema = z.object({
  match: z.string(),
  target: z.string(),
  enabled: z.boolean().optional()
});

/**
 * Custom error page mapping stored with a live server.
 */
export const liveServerErrorPageSchema = z.object({
  code: z.string(),
  path: z.string(),
  enabled: z.boolean().optional()
});

/**
 * Reverse proxy mapping stored with a live server.
 */
export const liveServerProxySchema = z.object({
  path: z.string(),
  target: z.string(),
  stripPath: z.boolean().optional(),
  enabled: z.boolean().optional()
});

/**
 * Mutable live server fields accepted by create and update routes.
 */
export const createLiveServerBodySchema = z.object({
  name: z.string(),
  root: z.string(),
  port: z.number().int().nullable(),
  aliases: z.array(liveServerAliasSchema),
  watch: z.boolean(),
  cors: z.object({
    enabled: z.boolean(),
    origin: z.string(),
    methods: z.string(),
    allowedHeaders: z.string(),
    exposedHeaders: z.string(),
    maxAge: z.string(),
    credentials: z.boolean()
  }),
  openPath: z.string(),
  openPathOnStartup: z.boolean(),
  rememberLastUrl: z.boolean(),
  lastOpenedPath: z.string().nullable(),
  indexFiles: z.array(z.string()),
  host: z.string(),
  headers: z.array(liveServerHeaderSchema),
  routes: z.array(liveServerRouteSchema),
  errorPages: z.array(liveServerErrorPageSchema),
  proxies: z.array(liveServerProxySchema),
  ssl: z.object({
    enabled: z.boolean(),
    certPath: z.string(),
    keyPath: z.string()
  }),
  runCommand: z.string(),
  runtimeId: z.string(),
  runCommandEnv: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
      enabled: z.boolean()
    })
  ),
  runCommandEnabled: z.boolean(),
  restartOnCrash: z.boolean(),
  urlVariable: z.string(),
  preRequestScripts: z.array(z.unknown()),
  postRequestScripts: z.array(z.unknown()),
  sortOrder: z.number().int().optional()
});

/**
 * JSON shape for a persisted live server record.
 */
export const liveServerRecordSchema = createLiveServerBodySchema.extend({
  id: z.string(),
  /**
   * Optional because older hubs omit it; prefer list index when absent.
   */
  sortOrder: z.number().int().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  createdByUserId: z.string().nullable(),
  updatedByUserId: z.string().nullable(),
  deletionLocked: deletionLockedSchema
}) satisfies z.ZodType<LiveServerRecord>;

/**
 * Mutable live page fields accepted by create and update routes.
 */
export const createLivePageBodySchema = z.object({
  name: z.string(),
  url: z.string(),
  homeUrl: z.string(),
  faviconDataUrl: z.string().nullable(),
  scripts: z.array(z.unknown()),
  preRequestScripts: z.array(z.unknown()),
  postRequestScripts: z.array(z.unknown()),
  variables: z.array(z.unknown()),
  headers: z.array(z.unknown()),
  userAgent: z.string(),
  auth: z.unknown()
});

/**
 * JSON shape for a persisted live page record.
 */
export const livePageRecordSchema = createLivePageBodySchema.extend({
  id: z.string(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  createdByUserId: z.string().nullable(),
  updatedByUserId: z.string().nullable(),
  deletionLocked: deletionLockedSchema
}) satisfies z.ZodType<LivePageRecord>;

/**
 * JSON shape for a persisted folder record.
 */
export const folderRecordSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  /**
   * Absent on hub servers that predate nested folders; those folders are roots.
   */
  parentFolderId: z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => value ?? null),
  name: z.string(),
  sortOrder: z.number().int(),
  createdAt: timestampSchema,
  marker: sidebarMarkerSchema
}) satisfies z.ZodType<FolderRecord>;

/**
 * Request body for creating a folder.
 */
export const createFolderBodySchema = z.object({
  name: z.string().trim().min(1),
  parentFolderId: z.string().nullable().optional(),
  marker: sidebarMarkerSchema
});

/**
 * Request body for reordering sibling folders.
 */
export const reorderFoldersBodySchema = z.object({
  parentFolderId: z.string().nullable(),
  orderedFolderIds: z.array(z.string().trim().min(1))
});

/**
 * Request body for moving a folder to a new parent.
 */
export const moveFolderBodySchema = z.object({
  parentFolderId: z.string().nullable(),
  sortOrder: z.number().int().nonnegative().optional()
});

/**
 * JSON shape for a persisted saved request record.
 */
export const savedRequestRecordSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  name: z.string(),
  protocol: requestProtocol,
  method: httpMethod,
  url: z.string(),
  headers: z.array(keyValue),
  params: z.array(keyValue),
  auth: teamHubAuthConfigSchema,
  body: z.string(),
  bodyType: bodyType,
  preRequestScript: z.string(),
  postRequestScript: z.string(),
  comment: z.string(),
  folderId: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  marker: sidebarMarkerSchema
}) satisfies z.ZodType<SavedRequestRecord>;

/**
 * Response body schema for `GET /health`.
 */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string()
}) satisfies z.ZodType<HealthResponse>;

/**
 * Response body schema for `GET /auth/session`.
 */
export const sessionResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    role: z.enum(['admin', 'user'])
  }),
  token: z.object({
    id: z.string(),
    prefix: z.string()
  }),
  capabilities: z.object({
    dataApi: z.boolean(),
    managementApi: z.boolean(),
    llm: z.boolean()
  })
}) satisfies z.ZodType<SessionResponse>;

/**
 * JSON shape for a Team Hub user account returned by management routes.
 */
export const hubUserRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['admin', 'user']),
  collectionAccess: z.array(z.string()),
  environmentAccess: z.array(z.string()),
  snippetAccess: z.array(z.string()),
  liveServerAccess: z.array(z.string()),
  livePageAccess: z.array(z.string()),
  llmAccess: z.boolean(),
  llmModels: z.array(z.string()),
  llmMonthlyTokenLimit: z.number().int().nonnegative().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
}) satisfies z.ZodType<HubUserRecord>;

/**
 * List response wrapper for admin user listings.
 */
export const listAdminUsersResponseSchema = z.object({
  users: z.array(hubUserRecordSchema)
});

/**
 * Lightweight id/name record returned by admin list routes.
 */
export const adminResourceOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  deletionLocked: deletionLockedSchema
});

/**
 * Response body schema for admin entity configuration updates.
 */
export const adminEntityConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  deletionLocked: deletionLockedSchema
});

/**
 * Request body schema for `PUT /admin/collections/:id`.
 */
export const updateAdminCollectionBodySchema = z.object({
  deletionLocked: z.boolean()
});

/**
 * Request body schema for `PUT /admin/environments/:id`.
 */
export const updateAdminEnvironmentBodySchema = z.object({
  deletionLocked: z.boolean()
});

/**
 * List response wrapper for admin collection listings.
 */
export const listAdminCollectionsResponseSchema = z.object({
  collections: z.array(adminResourceOptionSchema)
});

/**
 * List response wrapper for admin environment listings.
 */
export const listAdminEnvironmentsResponseSchema = z.object({
  environments: z.array(adminResourceOptionSchema)
});

/**
 * List response wrapper for admin snippet listings.
 */
export const listAdminSnippetsResponseSchema = z.object({
  snippets: z.array(snippetRecordSchema)
});

/**
 * Request body schema for `PUT /admin/users/:id`.
 */
export const updateAdminUserBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.enum(['admin', 'user']).optional(),
  collectionAccess: z.array(z.string()).optional(),
  environmentAccess: z.array(z.string()).optional(),
  snippetAccess: z.array(z.string()).optional(),
  liveServerAccess: z.array(z.string()).optional(),
  livePageAccess: z.array(z.string()).optional(),
  llmAccess: z.boolean().optional(),
  llmModels: z.array(z.string()).optional(),
  llmMonthlyTokenLimit: z.number().int().nonnegative().nullable().optional()
});

/**
 * Request body schema for `POST /admin/users`.
 */
export const createAdminUserBodySchema = z.object({
  name: z.string().trim().min(1),
  role: z.enum(['admin', 'user']),
  collectionAccess: z.array(z.string()).optional(),
  environmentAccess: z.array(z.string()).optional(),
  snippetAccess: z.array(z.string()).optional(),
  liveServerAccess: z.array(z.string()).optional(),
  livePageAccess: z.array(z.string()).optional(),
  llmAccess: z.boolean().optional(),
  llmModels: z.array(z.string()).optional(),
  llmMonthlyTokenLimit: z.number().int().nonnegative().nullable().optional()
});

/**
 * JSON shape for an API token record returned by admin token routes.
 */
export const hubApiTokenRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  tokenPrefix: z.string(),
  createdAt: timestampSchema,
  lastUsedAt: timestampSchema.nullable(),
  revokedAt: timestampSchema.nullable()
});

/**
 * Response body schema for `POST /admin/users`.
 */
export const createAdminUserResponseSchema = z.object({
  user: hubUserRecordSchema,
  token: hubApiTokenRecordSchema,
  secret: z.string()
});

/**
 * Request body schema for `POST /admin/users/:id/tokens`.
 */
export const createAdminTokenBodySchema = z.object({
  name: z.string().trim().min(1)
});

/**
 * Response body schema for `POST /admin/users/:id/tokens`.
 */
export const createdApiTokenResponseSchema = z.object({
  token: hubApiTokenRecordSchema,
  secret: z.string()
});

/**
 * List response wrapper for admin token listings.
 */
export const listAdminTokensResponseSchema = z.object({
  tokens: z.array(hubApiTokenRecordSchema)
});

/**
 * Per-section outcome reported by config reload routes.
 */
export const reloadConfigSectionResultSchema = z.object({
  section: z.enum(['db', 'redis', 'llm', 'plugins', 'server']),
  status: z.enum(['reloaded', 'unchanged', 'failed', 'restart-required']),
  error: z.string().optional()
});

/**
 * Response body schema for `POST /admin/config/reload`.
 */
export const reloadConfigResponseSchema = z.object({
  sections: z.array(reloadConfigSectionResultSchema),
  fatalError: z.string().optional()
});

/**
 * List response wrapper for collections.
 */
export const listCollectionsResponseSchema = z.object({
  collections: z.array(collectionRecordSchema)
});

/**
 * List response wrapper for environments.
 */
export const listEnvironmentsResponseSchema = z.object({
  environments: z.array(environmentRecordSchema)
});

/**
 * List response wrapper for snippets.
 */
export const listSnippetsResponseSchema = z.object({
  snippets: z.array(snippetRecordSchema)
});

/**
 * List response wrapper for live servers.
 */
export const listLiveServersResponseSchema = z.object({
  liveServers: z.array(liveServerRecordSchema)
});

/**
 * List response wrapper for live pages.
 */
export const listLivePagesResponseSchema = z.object({
  livePages: z.array(livePageRecordSchema)
});

/**
 * List response wrapper for folders.
 */
export const listFoldersResponseSchema = z.object({
  folders: z.array(folderRecordSchema)
});

/**
 * List response wrapper for saved requests.
 */
export const listRequestsResponseSchema = z.object({
  requests: z.array(savedRequestRecordSchema)
});

/**
 * JSON shape for a persisted markdown document record.
 */
export const documentRecordSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  folderId: z.string().nullable(),
  name: z.string(),
  content: z.string(),
  sortOrder: z.number().int(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  marker: sidebarMarkerSchema
}) satisfies z.ZodType<DocumentRecord>;

/**
 * List response wrapper for markdown documents.
 */
export const listDocumentsResponseSchema = z.object({
  documents: z.array(documentRecordSchema)
});

/**
 * JSON shape for one hub-offered LLM model.
 */
export const hubLlmModelSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: z.enum(['openai', 'claude', 'gemini'])
});

/**
 * JSON shape for hub LLM capability flags.
 */
export const hubLlmCapabilitiesSchema = z.object({
  openai: z.boolean()
});

/**
 * JSON shape for GET /llm/models response body.
 */
export const listHubLlmModelsResponseSchema = z.object({
  models: z.array(hubLlmModelSchema),
  capabilities: hubLlmCapabilitiesSchema
});

/**
 * JSON shape for GET /plugins/sources response body.
 */
export const pluginSourcesResponseSchema = z.object({
  catalogs: z.array(z.string()),
  trusted: z.array(z.string())
});

/**
 * JSON shape for POST /llm/chat/step response body.
 */
export const hubChatStepResponseSchema = z.object({
  content: z.string().nullable(),
  toolCalls: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        arguments: z.string()
      })
    )
    .optional(),
  usage: z.object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative()
  })
});

/**
 * Pass/fail/skip counts for a persisted run result snapshot.
 */
export const runResultSummaryCountsSchema = z.object({
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative()
});

/**
 * JSON shape for a persisted run result list/detail record.
 */
export const runResultRecordSchema = z.object({
  id: z.string(),
  kind: z.enum(['collection-run-results', 'request-run-results']),
  label: z.string(),
  collectionName: z.string().nullable(),
  requestName: z.string().nullable(),
  summary: runResultSummaryCountsSchema,
  createdAt: timestampSchema,
  createdByUserId: z.string().nullable()
}) satisfies z.ZodType<RunResultRecord>;

/**
 * JSON shape for a run result detail response including payload.
 */
export const runResultDetailSchema = runResultRecordSchema.extend({
  payload: z.record(z.string(), z.unknown())
}) satisfies z.ZodType<RunResultDetail>;

/**
 * Request body schema for `POST /run-results`.
 */
export const createRunResultBodySchema = z.object({
  label: z.string().trim().min(1).optional(),
  payload: z.record(z.string(), z.unknown())
});

/**
 * List response wrapper for run results.
 */
export const listRunResultsResponseSchema = z.object({
  runResults: z.array(runResultRecordSchema)
});

/**
 * Admin list response wrapper for run results.
 */
export const listAdminRunResultsResponseSchema = z.object({
  runResults: z.array(runResultRecordSchema)
});

/**
 * Computed invitation lifecycle status exposed to admin clients.
 */
export const invitationStatusSchema = z.enum(['pending', 'redeemed', 'revoked', 'expired']);

/**
 * Invitation metadata returned by admin routes (never includes the secret hash).
 */
export const hubInvitationRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  codePrefix: z.string(),
  expiresAt: timestampSchema,
  redeemedAt: timestampSchema.nullable(),
  revokedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  status: invitationStatusSchema
});

/**
 * Request body schema for `POST /admin/invited-users`.
 */
export const createAdminInvitedUserBodySchema = createAdminUserBodySchema.extend({
  expiresInHours: z.number().int().positive().optional()
});

/**
 * Request body schema for `POST /admin/users/:id/invitations`.
 */
export const createUserInvitationBodySchema = z.object({
  expiresInHours: z.number().int().positive().optional()
});

/**
 * Response body schema for `POST /admin/invited-users` and `POST /admin/users/:id/invitations`.
 */
export const createAdminInvitationResponseSchema = z.object({
  user: hubUserRecordSchema,
  invitation: hubInvitationRecordSchema,
  secret: z.string()
});

/**
 * Response body schema for `GET /admin/invitations`.
 */
export const listAdminInvitationsResponseSchema = z.object({
  invitations: z.array(hubInvitationRecordSchema)
});

/**
 * Request body schema for public invitation preview and redeem routes.
 */
export const invitationSecretBodySchema = z.object({
  secret: z.string().trim().min(1)
});

/**
 * Request body schema for `POST /auth/invitations/redeem`.
 */
export const redeemInvitationBodySchema = invitationSecretBodySchema.extend({
  tokenName: z.string().trim().min(1).optional()
});

/**
 * User details returned by invitation preview without issuing a token.
 */
export const hubInvitationPreviewUserSchema = z.object({
  name: z.string(),
  role: z.enum(['admin', 'user']),
  collectionAccess: z.array(z.string()),
  environmentAccess: z.array(z.string()),
  snippetAccess: z.array(z.string()),
  liveServerAccess: z.array(z.string()),
  livePageAccess: z.array(z.string()),
  llmAccess: z.boolean(),
  llmModels: z.array(z.string())
});

/**
 * Response body schema for `POST /auth/invitations/preview`.
 */
export const previewInvitationResponseSchema = z.object({
  user: hubInvitationPreviewUserSchema,
  expiresAt: timestampSchema
});
