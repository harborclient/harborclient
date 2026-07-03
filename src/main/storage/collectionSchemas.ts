import { z } from 'zod';
import { normalizeVariable } from '#/main/storage/collectionVariables';
import { authConfig, bodyType, httpMethod, keyValue } from '#/main/schemas/common';
import type {
  CollectionExport,
  EnvironmentExport,
  ExportedFolder,
  ExportedRequest,
  RequestExport,
  Variable
} from '#/shared/types';

/**
 * Validates an optional portable document uuid from an export file.
 */
export const optionalDocumentUuid = z.string().uuid().optional();

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
    uuid: optionalDocumentUuid,
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
    uuid: folder.uuid,
    name: folder.name.trim(),
    sort_order: folder.sort_order
  }));

/**
 * Returns the index of the first duplicate folder name, or null when all names are unique.
 *
 * @param folders - Folder rows with normalized names.
 * @returns Index of the second occurrence, or null when names are unique.
 */
export function findDuplicateFolderIndex(folders: ReadonlyArray<{ name: string }>): number | null {
  const seen = new Set<string>();
  for (let index = 0; index < folders.length; index++) {
    const name = folders[index]?.name;
    if (name === undefined) {
      continue;
    }
    if (seen.has(name)) {
      return index;
    }
    seen.add(name);
  }
  return null;
}

/**
 * Returns the index of the first duplicate folder uuid, or null when all uuids are unique.
 *
 * @param folders - Folder rows with optional uuids.
 * @returns Index of the second occurrence, or null when uuids are unique or absent.
 */
export function findDuplicateFolderUuidIndex(
  folders: ReadonlyArray<{ uuid?: string }>
): number | null {
  const seen = new Set<string>();
  for (let index = 0; index < folders.length; index++) {
    const uuid = folders[index]?.uuid?.trim();
    if (!uuid) {
      continue;
    }
    if (seen.has(uuid)) {
      return index;
    }
    seen.add(uuid);
  }
  return null;
}

/**
 * Validates folder rows and applies index-based sort_order defaults.
 */
export const exportedFolders = z
  .array(exportedFolderRow)
  .default([])
  .transform((folders) =>
    folders.map(
      (folder, index): ExportedFolder => ({
        uuid: folder.uuid,
        name: folder.name,
        sort_order: typeof folder.sort_order === 'number' ? folder.sort_order : index
      })
    )
  )
  .superRefine((folders, ctx) => {
    const duplicateNameIndex = findDuplicateFolderIndex(folders);
    if (duplicateNameIndex !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'duplicate folder name',
        path: [duplicateNameIndex, 'name']
      });
    }

    const duplicateUuidIndex = findDuplicateFolderUuidIndex(folders);
    if (duplicateUuidIndex !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'duplicate folder uuid',
        path: [duplicateUuidIndex, 'uuid']
      });
    }
  });

const exportedRequestRow = z
  .object({
    uuid: optionalDocumentUuid,
    name: z.string(),
    method: httpMethod,
    url: z.string().default(''),
    headers: z.array(keyValue).default([]),
    params: z.array(keyValue).default([]),
    auth: authConfig.optional(),
    body: z.string().default(''),
    body_type: bodyType,
    pre_request_script: z.string().default(''),
    post_request_script: z.string().default(''),
    comment: z.string().default(''),
    tags: z.string().default(''),
    sort_order: z.number().optional(),
    folder_name: z.union([z.string(), z.null()]).optional(),
    folder_uuid: z.union([z.string().uuid(), z.null()]).optional()
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
    uuid: req.uuid,
    name: req.name.trim(),
    method: req.method,
    url: req.url,
    headers: req.headers,
    params: req.params,
    auth: req.auth,
    body: req.body,
    body_type: req.body_type,
    pre_request_script: req.pre_request_script,
    post_request_script: req.post_request_script,
    comment: req.comment,
    tags: req.tags,
    sort_order: req.sort_order,
    folder_name:
      typeof req.folder_name === 'string'
        ? req.folder_name.trim() || null
        : req.folder_name === null
          ? null
          : undefined,
    folder_uuid:
      typeof req.folder_uuid === 'string'
        ? req.folder_uuid.trim() || null
        : req.folder_uuid === null
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
  harborclientExport: z.literal('collection'),
  uuid: optionalDocumentUuid,
  name: z.string().trim().min(1, 'collection name is required'),
  variables: importVariables,
  headers: z.array(keyValue).default([]),
  auth: authConfig.optional(),
  pre_request_script: z.string().default(''),
  post_request_script: z.string().default(''),
  requests: exportedRequests
};

/**
 * Validates portable collection export files for import.
 */
export const collectionExportSchema = z.object({
  harborclientVersion: z.literal(1),
  ...collectionExportFields,
  folders: exportedFolders
}) satisfies z.ZodType<CollectionExport>;

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

  if (path[0] === 'harborclientVersion') {
    return 'unsupported format version';
  }

  if (path[0] === 'harborclientExport') {
    return 'not a HarborClient collection export';
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
      if (issue.message === 'duplicate folder name') {
        return `folder ${folderNumber} has a duplicate name`;
      }
      return `folder ${folderNumber} is missing a name`;
    }

    if (path[2] === 'uuid' && issue.message === 'duplicate folder uuid') {
      return `folder ${folderNumber} has a duplicate uuid`;
    }

    return `folder ${folderNumber} is malformed`;
  }

  const pathLabel = path.length > 0 ? path.join('.') : 'collection file';
  return issue.message ? `${pathLabel}: ${issue.message}` : pathLabel;
}

const requestExportRow = z
  .object({
    harborclientVersion: z.literal(1),
    harborclientExport: z.literal('request'),
    uuid: optionalDocumentUuid,
    name: z.string(),
    method: httpMethod,
    url: z.string().default(''),
    headers: z.array(keyValue).default([]),
    params: z.array(keyValue).default([]),
    auth: authConfig.optional(),
    body: z.string().default(''),
    body_type: bodyType,
    pre_request_script: z.string().default(''),
    post_request_script: z.string().default(''),
    comment: z.string().default(''),
    tags: z.string().default('')
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
    harborclientVersion: req.harborclientVersion,
    harborclientExport: req.harborclientExport,
    uuid: req.uuid,
    name: req.name.trim(),
    method: req.method,
    url: req.url,
    headers: req.headers,
    params: req.params,
    auth: req.auth,
    body: req.body,
    body_type: req.body_type,
    pre_request_script: req.pre_request_script,
    post_request_script: req.post_request_script,
    comment: req.comment,
    tags: req.tags
  }));

/**
 * Validates portable request export files for import.
 */
export const requestExportSchema = requestExportRow satisfies z.ZodType<RequestExport>;

/**
 * Maps a Zod validation failure to a user-facing request import error fragment.
 *
 * @param error - Zod error from requestExportSchema.safeParse.
 * @returns Message suffix after the "Invalid request file:" prefix.
 */
export function formatRequestImportError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return 'invalid request file';
  }

  const path = issue.path;

  if (path[0] === 'harborclientVersion') {
    return 'unsupported format version';
  }

  if (path[0] === 'harborclientExport') {
    return 'not a HarborClient request export';
  }

  if (path[0] === 'name') {
    return 'request name is required';
  }

  if (path[0] === 'method') {
    return 'request has an invalid method';
  }

  if (path[0] === 'body_type') {
    return 'request has an invalid body type';
  }

  if (path[0] === 'headers') {
    return 'request has invalid headers';
  }

  if (path[0] === 'params') {
    return 'request has invalid params';
  }

  const pathLabel = path.length > 0 ? path.join('.') : 'request file';
  return issue.message ? `${pathLabel}: ${issue.message}` : pathLabel;
}

/**
 * Validates portable environment export files for import.
 */
export const environmentExportSchema = z.object({
  harborclientVersion: z.literal(1),
  harborclientExport: z.literal('environment'),
  uuid: optionalDocumentUuid,
  name: z.string().trim().min(1, 'environment name is required'),
  variables: importVariables
}) satisfies z.ZodType<EnvironmentExport>;

/**
 * Maps a Zod validation failure to a user-facing environment import error fragment.
 *
 * @param error - Zod error from environmentExportSchema.safeParse.
 * @returns Message suffix after the "Invalid environment file:" prefix.
 */
export function formatEnvironmentImportError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return 'invalid environment file';
  }

  const path = issue.path;

  if (path[0] === 'harborclientVersion') {
    return 'unsupported format version';
  }

  if (path[0] === 'harborclientExport') {
    return 'not a HarborClient environment export';
  }

  if (path[0] === 'name') {
    return 'environment name is required';
  }

  const pathLabel = path.length > 0 ? path.join('.') : 'environment file';
  return issue.message ? `${pathLabel}: ${issue.message}` : pathLabel;
}
