import { z } from 'zod';
import { normalizeVariable } from '#/main/db/collectionVariables';
import { bodyType, httpMethod, keyValue } from '#/main/schemas/common';
import type { CollectionExport, ExportedFolder, ExportedRequest, Variable } from '#/shared/types';

/**
 * Normalizes imported collection variables and drops rows with no meaningful content.
 */
export const importVariables = z
  .array(z.unknown())
  .default([])
  .transform((items) =>
    items
      .map((item) =>
        normalizeVariable(
          item && typeof item === 'object' && !Array.isArray(item)
            ? (item as Partial<Variable>)
            : {}
        )
      )
      .filter((v) => v.key.trim() || v.value.trim() || v.defaultValue.trim())
  );

const exportedFolderRow = z
  .object({
    name: z.string(),
    sort_order: z.number().optional()
  })
  .superRefine((folder, ctx) => {
    if (!folder.name.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'missing a name',
        path: ['name']
      });
    }
  })
  .transform((folder) => ({
    name: folder.name.trim(),
    sort_order: folder.sort_order
  }));

/**
 * Validates folder rows and applies index-based sort_order defaults.
 */
export const exportedFolders = z
  .array(exportedFolderRow)
  .default([])
  .transform((folders) =>
    folders.map(
      (folder, index): ExportedFolder => ({
        name: folder.name,
        sort_order: typeof folder.sort_order === 'number' ? folder.sort_order : index
      })
    )
  );

const exportedRequestRow = z
  .object({
    name: z.string(),
    method: httpMethod,
    url: z.string().default(''),
    headers: z.array(keyValue).default([]),
    params: z.array(keyValue).default([]),
    body: z.string().default(''),
    body_type: bodyType,
    pre_request_script: z.string().default(''),
    post_request_script: z.string().default(''),
    comment: z.string().default(''),
    sort_order: z.number().optional(),
    folder_name: z.union([z.string(), z.null()]).optional()
  })
  .superRefine((req, ctx) => {
    if (!req.name.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'missing a name',
        path: ['name']
      });
    }
  })
  .transform((req) => ({
    name: req.name.trim(),
    method: req.method,
    url: req.url,
    headers: req.headers,
    params: req.params,
    body: req.body,
    body_type: req.body_type,
    pre_request_script: req.pre_request_script,
    post_request_script: req.post_request_script,
    comment: req.comment,
    sort_order: req.sort_order,
    folder_name:
      typeof req.folder_name === 'string'
        ? req.folder_name.trim() || null
        : req.folder_name === null
          ? null
          : undefined
  }));

/**
 * Validates exported request rows and applies index-based sort_order defaults.
 */
export const exportedRequests = z.array(exportedRequestRow).transform((requests) =>
  requests.map(
    (req, index): ExportedRequest => ({
      ...req,
      sort_order: typeof req.sort_order === 'number' ? req.sort_order : index
    })
  )
);

const collectionExportFields = {
  name: z.string().trim().min(1, 'collection name is required'),
  variables: importVariables,
  headers: z.array(keyValue).default([]),
  pre_request_script: z.string().default(''),
  post_request_script: z.string().default(''),
  requests: exportedRequests
};

/**
 * Validates portable collection export files for import.
 */
export const collectionExportSchema = z.discriminatedUnion('formatVersion', [
  z.object({
    formatVersion: z.literal(1),
    ...collectionExportFields
  }),
  z.object({
    formatVersion: z.literal(2),
    ...collectionExportFields,
    folders: exportedFolders
  })
]) satisfies z.ZodType<CollectionExport>;

/**
 * Maps a Zod validation failure to a user-facing import error fragment.
 *
 * @param error - Zod error from collectionExportSchema.safeParse.
 * @returns Message suffix after the "Invalid collection file:" prefix.
 */
export function formatCollectionImportError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return 'invalid collection file';
  }

  const path = issue.path;

  if (path[0] === 'formatVersion') {
    return 'unsupported format version';
  }

  if (path[0] === 'name') {
    return 'collection name is required';
  }

  if (path[0] === 'headers') {
    return 'collection headers are malformed';
  }

  if (path[0] === 'requests' && path.length === 1) {
    return 'requests must be an array';
  }

  if (path[0] === 'requests' && typeof path[1] === 'number') {
    const requestNumber = path[1] + 1;
    const field = path[2];

    if (field === undefined) {
      return `request ${requestNumber} is malformed`;
    }

    if (field === 'method') {
      return `request ${requestNumber} has an invalid method`;
    }

    if (field === 'body_type') {
      return `request ${requestNumber} has an invalid body type`;
    }

    if (field === 'name') {
      return `request ${requestNumber} is missing a name`;
    }

    if (field === 'headers') {
      return `request ${requestNumber} has invalid headers`;
    }

    if (field === 'params') {
      return `request ${requestNumber} has invalid params`;
    }
  }

  if (path[0] === 'folders' && typeof path[1] === 'number') {
    const folderNumber = path[1] + 1;

    if (path[2] === 'name') {
      return `folder ${folderNumber} is missing a name`;
    }

    return `folder ${folderNumber} is malformed`;
  }

  const pathLabel = path.length > 0 ? path.join('.') : 'collection file';
  return issue.message ? `${pathLabel}: ${issue.message}` : pathLabel;
}
