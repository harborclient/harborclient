import { z } from 'zod';
import type {
  CollectionRecord,
  EnvironmentRecord,
  FolderRecord,
  HealthResponse,
  HubUserRecord,
  SavedRequestRecord,
  SessionResponse
} from '#/main/teamHub/types';
import { authConfig, bodyType, httpMethod, keyValue, variable } from '#/main/schemas/common';

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
 * JSON shape for a persisted collection record.
 */
export const collectionRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  variables: z.array(variable),
  headers: z.array(keyValue),
  auth: authConfig,
  preRequestScript: z.string(),
  postRequestScript: z.string(),
  createdAt: timestampSchema
}) satisfies z.ZodType<CollectionRecord>;

/**
 * JSON shape for a persisted environment record.
 */
export const environmentRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  variables: z.array(variable),
  createdAt: timestampSchema
}) satisfies z.ZodType<EnvironmentRecord>;

/**
 * JSON shape for a persisted folder record.
 */
export const folderRecordSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  createdAt: timestampSchema
}) satisfies z.ZodType<FolderRecord>;

/**
 * JSON shape for a persisted saved request record.
 */
export const savedRequestRecordSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  name: z.string(),
  method: httpMethod,
  url: z.string(),
  headers: z.array(keyValue),
  params: z.array(keyValue),
  auth: authConfig,
  body: z.string(),
  bodyType: bodyType,
  preRequestScript: z.string(),
  postRequestScript: z.string(),
  comment: z.string(),
  folderId: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
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
  name: z.string()
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
 * Request body schema for `PUT /admin/users/:id`.
 */
export const updateAdminUserBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.enum(['admin', 'user']).optional(),
  collectionAccess: z.array(z.string()).optional(),
  environmentAccess: z.array(z.string()).optional(),
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
 * JSON shape for one hub-offered LLM model.
 */
export const hubLlmModelSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: z.enum(['openai', 'claude', 'gemini'])
});

/**
 * JSON shape for GET /llm/models response body.
 */
export const listHubLlmModelsResponseSchema = z.object({
  models: z.array(hubLlmModelSchema)
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
