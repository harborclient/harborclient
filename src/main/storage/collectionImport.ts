import { defaultAuth } from '#/shared/auth';
import type {
  AuthConfig,
  CollectionDocument,
  CollectionExport,
  ExportedDocument,
  ExportedFolder,
  ExportedRequest,
  Folder,
  KeyValue,
  SavedRequest,
  ScriptRef,
  Variable
} from '#/shared/types';
import { bundleScriptFieldsWithLegacy } from '#/main/storage/scriptFields';
import { maskVariablesForExport } from '#/main/storage/collectionData';
import { resolveImportUuid } from '#/main/storage/uuid';
import { normalizeRequestTags } from '#/shared/requestTags';
import { serializeSidebarColor } from '#/main/storage/sidebarColorMigration';
import { mirrorLegacyScriptString, resolveScriptRefs } from '#/shared/scriptRefs';

/**
 * Maps built during folder import for resolving request folder placement.
 */
export interface FolderImportMaps {
  /** Folder uuid to local folder id. */
  folderIdByUuid: Map<string, number>;
  /** Folder name to local folder id (legacy fallback). */
  folderIdByName: Map<string, number>;
  /** Local folder id to folder uuid for legacy name matches. */
  folderUuidById: Map<number, string>;
}

/**
 * Resolves a folder id from exported request folder_uuid and folder_name fields.
 *
 * @param folderUuid - Portable folder uuid from the export row, if any.
 * @param folderName - Folder name from the export row, if any.
 * @param folderIdByUuid - Map of folder uuid to local folder id.
 * @param folderIdByName - Map of folder name to local folder id.
 * @returns Local folder id, or null for collection root.
 */
export function resolveImportFolderId(
  folderUuid: string | null | undefined,
  folderName: string | null | undefined,
  folderIdByUuid: Map<string, number>,
  folderIdByName: Map<string, number>
): number | null {
  const trimmedUuid = folderUuid?.trim();
  if (trimmedUuid) {
    const byUuid = folderIdByUuid.get(trimmedUuid);
    if (byUuid != null) {
      return byUuid;
    }
  }

  if (folderName == null || !folderName.trim()) {
    return null;
  }
  return folderIdByName.get(folderName) ?? null;
}

/**
 * Builds folder import maps from folders already stored in the target collection.
 *
 * @param folders - Folders already stored in the target collection.
 * @returns Uuid and name indexes for import upsert and request placement.
 */
export function buildFolderImportMaps(folders: Folder[]): FolderImportMaps {
  const folderIdByUuid = buildFolderUuidIndex(folders);
  const folderUuidById = new Map<number, string>();
  for (const folder of folders) {
    const uuid = folder.uuid.trim();
    if (uuid) {
      folderUuidById.set(folder.id, uuid);
    }
  }

  return {
    folderIdByUuid,
    folderIdByName: buildFolderNameIndex(folders),
    folderUuidById
  };
}

/**
 * Builds a map of existing request uuid to local request id for upsert during import.
 *
 * @param requests - Requests already stored in the target collection.
 * @returns Map keyed by non-empty request uuid.
 */
export function buildRequestUuidIndex(requests: SavedRequest[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const request of requests) {
    const uuid = request.uuid.trim();
    if (uuid) {
      index.set(uuid, request.id);
    }
  }
  return index;
}

/**
 * Builds a map of existing document uuid to local document id for upsert during import.
 *
 * @param documents - Documents already stored in the target collection.
 * @returns Map keyed by non-empty document uuid.
 */
export function buildDocumentUuidIndex(documents: CollectionDocument[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const document of documents) {
    const uuid = document.uuid.trim();
    if (uuid) {
      index.set(uuid, document.id);
    }
  }
  return index;
}

/**
 * Builds a map of existing folder uuid to local folder id for upsert during import.
 *
 * @param folders - Folders already stored in the target collection.
 * @returns Map keyed by non-empty folder uuid.
 */
export function buildFolderUuidIndex(folders: Folder[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const folder of folders) {
    const uuid = folder.uuid.trim();
    if (uuid) {
      index.set(uuid, folder.id);
    }
  }
  return index;
}

/**
 * Builds a map of existing folder name to local folder id for upsert during import.
 *
 * @param folders - Folders already stored in the target collection.
 * @returns Map keyed by folder name.
 */
export function buildFolderNameIndex(folders: Folder[]): Map<string, number> {
  return new Map(folders.map((folder) => [folder.name, folder.id]));
}

/**
 * Returns the uuid to persist for an imported folder row.
 *
 * @param folder - Exported folder row from a collection file.
 * @returns Resolved uuid string for insert or update.
 */
export function resolveImportedFolderUuid(folder: ExportedFolder): string {
  return resolveImportUuid(folder.uuid);
}

/**
 * Planned folder upsert action during collection import update.
 */
export type ImportedFolderUpsertPlan =
  | {
      action: 'update';
      existingId: number;
      name: string;
      sort_order: number;
      uuid: string;
      color: string | null;
    }
  | {
      action: 'insert';
      name: string;
      sort_order: number;
      uuid: string;
      color: string | null;
    };

/**
 * Determines whether an exported folder row updates an existing folder or inserts a new one.
 *
 * Matches by uuid when the export row includes one; otherwise falls back to name for legacy files.
 *
 * @param folder - Exported folder row from a collection file.
 * @param maps - Current folder uuid and name indexes for the target collection.
 * @returns Upsert plan for the backend to execute.
 */
export function planImportedFolderUpsert(
  folder: ExportedFolder,
  maps: FolderImportMaps
): ImportedFolderUpsertPlan {
  const hasFileUuid = Boolean(folder.uuid?.trim());
  const resolvedUuid = resolveImportedFolderUuid(folder);

  if (hasFileUuid) {
    const existingId = maps.folderIdByUuid.get(resolvedUuid);
    if (existingId != null) {
      return {
        action: 'update',
        existingId,
        name: folder.name,
        sort_order: folder.sort_order,
        uuid: resolvedUuid,
        color: serializeSidebarColor(folder.color)
      };
    }

    return {
      action: 'insert',
      name: folder.name,
      sort_order: folder.sort_order,
      uuid: resolvedUuid,
      color: serializeSidebarColor(folder.color)
    };
  }

  const existingByName = maps.folderIdByName.get(folder.name);
  if (existingByName != null) {
    return {
      action: 'update',
      existingId: existingByName,
      name: folder.name,
      sort_order: folder.sort_order,
      uuid: maps.folderUuidById.get(existingByName) ?? resolvedUuid,
      color: serializeSidebarColor(folder.color)
    };
  }

  return {
    action: 'insert',
    name: folder.name,
    sort_order: folder.sort_order,
    uuid: resolvedUuid,
    color: serializeSidebarColor(folder.color)
  };
}

/**
 * Registers a folder id in import maps after insert or update.
 *
 * @param maps - Folder import maps to mutate.
 * @param folderId - Local folder id that was inserted or updated.
 * @param name - Folder display name.
 * @param uuid - Folder portable uuid.
 */
export function registerImportedFolderInMaps(
  maps: FolderImportMaps,
  folderId: number,
  name: string,
  uuid: string
): void {
  maps.folderIdByUuid.set(uuid, folderId);
  maps.folderIdByName.set(name, folderId);
  maps.folderUuidById.set(folderId, uuid);
}

/**
 * Returns the uuid to persist for an imported request row.
 *
 * @param request - Exported request row from a collection file.
 * @returns Resolved uuid string for insert or update.
 */
export function resolveImportedRequestUuid(request: ExportedRequest): string {
  return resolveImportUuid(request.uuid);
}

/**
 * Returns the uuid to persist for an imported collection payload.
 *
 * @param payload - Validated collection export.
 * @returns Resolved uuid string for insert.
 */
export function resolveImportedCollectionUuid(payload: CollectionExport): string {
  return resolveImportUuid(payload.uuid);
}

/**
 * Returns the uuid to persist for an imported document row.
 *
 * @param document - Exported document row from a collection file.
 * @returns Resolved uuid string for insert or update.
 */
export function resolveImportedDocumentUuid(document: ExportedDocument): string {
  return resolveImportUuid(document.uuid);
}

/**
 * Converts a saved document into a portable export row with folder placement metadata.
 *
 * @param document - Saved document from storage.
 * @param folderName - Folder display name, or null at collection root.
 * @param folderUuid - Portable folder uuid, or null at collection root.
 * @returns Export row without database ids.
 */
export function savedDocumentToExportedDocument(
  document: CollectionDocument,
  folderName: string | null,
  folderUuid: string | null
): ExportedDocument {
  return {
    uuid: document.uuid,
    name: document.name,
    content: document.content,
    sort_order: document.sort_order,
    folder_name: folderName,
    folder_uuid: folderUuid,
    color: document.color ?? null
  };
}

/**
 * Serializes document fields shared by insert and update during collection import.
 *
 * @param document - Exported document row.
 * @returns Normalized fields for SQL persistence.
 */
export function serializeImportedDocumentFields(document: ExportedDocument): {
  name: string;
  content: string;
  sort_order: number;
  uuid: string;
  color: string | null;
} {
  return {
    name: document.name,
    content: document.content,
    sort_order: document.sort_order,
    uuid: resolveImportedDocumentUuid(document),
    color: serializeSidebarColor(document.color)
  };
}

/**
 * Converts a saved request into a portable export row with folder placement metadata.
 *
 * @param request - Saved request from storage.
 * @param folderName - Folder display name, or null at collection root.
 * @param folderUuid - Portable folder uuid, or null at collection root.
 * @returns Export row without database ids.
 */
export function savedRequestToExportedRequest(
  request: SavedRequest,
  folderName: string | null,
  folderUuid: string | null
): ExportedRequest {
  return {
    uuid: request.uuid,
    name: request.name,
    method: request.method,
    url: request.url,
    headers: request.headers,
    params: request.params,
    auth: request.auth,
    body: request.body,
    body_type: request.body_type,
    pre_request_script: request.pre_request_script,
    post_request_script: request.post_request_script,
    pre_request_scripts: request.pre_request_scripts,
    post_request_scripts: request.post_request_scripts,
    comment: request.comment,
    tags: request.tags,
    sort_order: request.sort_order,
    folder_name: folderName,
    folder_uuid: folderUuid,
    color: request.color ?? null
  };
}

/**
 * Resolves collection-level script columns from a portable export payload.
 *
 * @param payload - Validated collection export.
 * @returns Legacy mirror strings and serialized script reference JSON columns.
 */
export function serializeImportedCollectionScriptFields(payload: CollectionExport): {
  pre_request_script: string;
  post_request_script: string;
  pre_request_scripts_json: string;
  post_request_scripts_json: string;
} {
  const preScripts = bundleScriptFieldsWithLegacy(
    payload.pre_request_scripts,
    payload.pre_request_script
  );
  const postScripts = bundleScriptFieldsWithLegacy(
    payload.post_request_scripts,
    payload.post_request_script
  );
  return {
    pre_request_script: preScripts.legacy,
    post_request_script: postScripts.legacy,
    pre_request_scripts_json: preScripts.json,
    post_request_scripts_json: postScripts.json
  };
}

/**
 * Converts a persisted folder row into a portable export shape.
 *
 * @param folder - Folder loaded from storage.
 * @returns Portable folder export row.
 */
export function exportedFolderFromFolder(folder: Folder): ExportedFolder {
  return {
    uuid: folder.uuid,
    name: folder.name,
    sort_order: folder.sort_order,
    variables: maskVariablesForExport(folder.variables),
    headers: folder.headers,
    auth: folder.auth,
    pre_request_script: folder.pre_request_script,
    post_request_script: folder.post_request_script,
    pre_request_scripts: folder.pre_request_scripts,
    post_request_scripts: folder.post_request_scripts,
    color: folder.color ?? null
  };
}

/**
 * Resolves folder-level script columns from a portable export row.
 *
 * @param folder - Exported folder row.
 * @returns Serialized folder settings columns for SQL persistence.
 */
export function serializeImportedFolderFields(folder: ExportedFolder): {
  variablesJson: string;
  headersJson: string;
  authJson: string;
  pre_request_script: string;
  post_request_script: string;
  pre_request_scripts_json: string;
  post_request_scripts_json: string;
  color: string | null;
} {
  const preScripts = bundleScriptFieldsWithLegacy(
    folder.pre_request_scripts,
    folder.pre_request_script ?? ''
  );
  const postScripts = bundleScriptFieldsWithLegacy(
    folder.post_request_scripts,
    folder.post_request_script ?? ''
  );
  return {
    variablesJson: JSON.stringify(folder.variables ?? []),
    headersJson: JSON.stringify(folder.headers ?? []),
    authJson: JSON.stringify(folder.auth ?? defaultAuth()),
    pre_request_script: preScripts.legacy,
    post_request_script: postScripts.legacy,
    pre_request_scripts_json: preScripts.json,
    post_request_scripts_json: postScripts.json,
    color: serializeSidebarColor(folder.color)
  };
}

/**
 * Resolves folder settings from a portable export row with safe defaults for legacy exports.
 *
 * @param folder - Exported folder row from a collection import payload.
 * @returns Normalized folder settings suitable for storage updateFolder calls.
 */
export function resolveImportedFolderSettings(folder: ExportedFolder): {
  variables: Variable[];
  headers: KeyValue[];
  auth: AuthConfig;
  preRequestScript: string;
  postRequestScript: string;
  preRequestScripts: ScriptRef[];
  postRequestScripts: ScriptRef[];
} {
  const preRequestScript = folder.pre_request_script ?? '';
  const postRequestScript = folder.post_request_script ?? '';
  return {
    variables: folder.variables ?? [],
    headers: folder.headers ?? [],
    auth: folder.auth ?? defaultAuth(),
    preRequestScript,
    postRequestScript,
    preRequestScripts: resolveScriptRefs(folder.pre_request_scripts, preRequestScript),
    postRequestScripts: resolveScriptRefs(folder.post_request_scripts, postRequestScript)
  };
}

/**
 * Converts a portable folder export row into a git manifest folder row.
 *
 * @param folder - Exported folder row.
 * @param index - Fallback sort order when the export omits one.
 * @returns Stored folder row for collection.json.
 */
export function importedFolderToStoredRow(
  folder: ExportedFolder,
  index = 0
): {
  uuid: string;
  name: string;
  sort_order: number;
  variables: Variable[];
  headers: KeyValue[];
  auth: AuthConfig;
  pre_request_script: string;
  post_request_script: string;
  pre_request_scripts: ScriptRef[];
  post_request_scripts: ScriptRef[];
  color: string | null;
} {
  const preScripts = bundleScriptFieldsWithLegacy(
    folder.pre_request_scripts,
    folder.pre_request_script ?? ''
  );
  const postScripts = bundleScriptFieldsWithLegacy(
    folder.post_request_scripts,
    folder.post_request_script ?? ''
  );
  const preRefs = resolveScriptRefs(folder.pre_request_scripts, folder.pre_request_script ?? '');
  const postRefs = resolveScriptRefs(folder.post_request_scripts, folder.post_request_script ?? '');
  return {
    uuid: resolveImportUuid(folder.uuid),
    name: folder.name.trim(),
    sort_order: folder.sort_order ?? index,
    variables: folder.variables ?? [],
    headers: folder.headers ?? [],
    auth: folder.auth ?? defaultAuth(),
    pre_request_script: preScripts.legacy,
    post_request_script: postScripts.legacy,
    pre_request_scripts: preRefs,
    post_request_scripts: postRefs,
    color: serializeSidebarColor(folder.color)
  };
}

/**
 * Serializes request fields shared by insert and update during collection import.
 *
 * @param request - Exported request row.
 * @returns Tuple of bound values for SQL statements.
 */
export function serializeImportedRequestFields(request: ExportedRequest): {
  name: string;
  method: ExportedRequest['method'];
  url: string;
  headersJson: string;
  paramsJson: string;
  authJson: string;
  body: string;
  body_type: ExportedRequest['body_type'];
  pre_request_script: string;
  post_request_script: string;
  pre_request_scripts_json: string;
  post_request_scripts_json: string;
  comment: string;
  tags: string;
  sort_order: number;
  uuid: string;
  color: string | null;
} {
  const preScripts = bundleScriptFieldsWithLegacy(
    request.pre_request_scripts,
    request.pre_request_script
  );
  const postScripts = bundleScriptFieldsWithLegacy(
    request.post_request_scripts,
    request.post_request_script
  );

  return {
    name: request.name,
    method: request.method,
    url: request.url,
    headersJson: JSON.stringify(request.headers),
    paramsJson: JSON.stringify(request.params),
    authJson: JSON.stringify(request.auth ?? defaultAuth()),
    body: request.body,
    body_type: request.body_type,
    pre_request_script: preScripts.legacy,
    post_request_script: postScripts.legacy,
    pre_request_scripts_json: preScripts.json,
    post_request_scripts_json: postScripts.json,
    comment: request.comment,
    tags: normalizeRequestTags(request.tags),
    sort_order: request.sort_order,
    uuid: resolveImportedRequestUuid(request),
    color: serializeSidebarColor(request.color)
  };
}

/**
 * Resolves script list fields from a portable request export row for saveRequest callers.
 *
 * @param request - Exported request row from a collection or request file.
 * @returns Legacy mirror strings and canonical script reference arrays.
 */
export function importedRequestScriptFields(request: ExportedRequest): {
  pre_request_script: string;
  post_request_script: string;
  pre_request_scripts: ReturnType<typeof resolveScriptRefs>;
  post_request_scripts: ReturnType<typeof resolveScriptRefs>;
} {
  const preRequestScripts = resolveScriptRefs(
    request.pre_request_scripts,
    request.pre_request_script
  );
  const postRequestScripts = resolveScriptRefs(
    request.post_request_scripts,
    request.post_request_script
  );
  return {
    pre_request_script: mirrorLegacyScriptString(preRequestScripts),
    post_request_script: mirrorLegacyScriptString(postRequestScripts),
    pre_request_scripts: preRequestScripts,
    post_request_scripts: postRequestScripts
  };
}
