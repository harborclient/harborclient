import { z } from 'zod';
import type {
  CollectionRecord,
  EnvironmentRecord,
  FolderRecord,
  HealthResponse,
  SavedRequestRecord
} from '#/main/server/types';
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
