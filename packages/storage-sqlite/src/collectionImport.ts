import { defaultAuth } from '@harborclient/core/auth';
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
} from '@harborclient/core/types';
import { bundleScriptFieldsWithLegacy } from './scriptFields';
import { maskVariablesForExport } from './collectionData';
import { resolveImportUuid } from './uuid';
import { normalizeRequestTags } from '@harborclient/core/requestTags';
import { serializeSidebarMarker } from './sidebarMarkerMigration';
import { mirrorLegacyScriptString, resolveScriptRefs } from '@harborclient/core/scriptRefs';

/**
 * Maps built during folder import for resolving request folder placement.
 */
export interface FolderImportMaps {
  /** Folder uuid to local folder id. */
  folderIdByUuid: Map<string, number>;
  /** Folder name to local folder id (legacy fallback). */
  folderIdByName: Map<string, number>;
  /**
   * Sibling-scoped folder name to local folder id.
   *
   * Keyed by {@link folderSiblingNameKey} so identically named folders under
   * different parents do not collide during Postman/OpenCollection refresh.
   */
  folderIdByParentAndName: Map<string, number>;
  /** Local folder id to its current sibling-name key for map cleanup on move/rename. */
  folderParentAndNameById: Map<number, string>;
  /** Local folder id to folder uuid for legacy name matches. */
  folderUuidById: Map<number, string>;
}

/**
 * Builds the map key for a folder name among siblings under one parent.
 *
 * @param parentFolderId - Parent folder id, or null for collection root.
 * @param name - Folder display name.
 * @returns Stable key for {@link FolderImportMaps.folderIdByParentAndName}.
 */
export function folderSiblingNameKey(parentFolderId: number | null, name: string): string {
  return `${parentFolderId ?? ''}\0${name}`;
}

/**
 * Creates empty folder import maps for a fresh collection import.
 *
 * @returns Empty uuid, name, and sibling-name indexes.
 */
export function createEmptyFolderImportMaps(): FolderImportMaps {
  return {
    folderIdByUuid: new Map(),
    folderIdByName: new Map(),
    folderIdByParentAndName: new Map(),
    folderParentAndNameById: new Map(),
    folderUuidById: new Map()
  };
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
  const folderIdByParentAndName = new Map<string, number>();
  const folderParentAndNameById = new Map<number, string>();
  for (const folder of folders) {
    const uuid = folder.uuid.trim();
    if (uuid) {
      folderUuidById.set(folder.id, uuid);
    }
    const siblingKey = folderSiblingNameKey(folder.parent_folder_id ?? null, folder.name);
    folderIdByParentAndName.set(siblingKey, folder.id);
    folderParentAndNameById.set(folder.id, siblingKey);
  }

  return {
    folderIdByUuid,
    folderIdByName: buildFolderNameIndex(folders),
    folderIdByParentAndName,
    folderParentAndNameById,
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
 * Builds a fingerprint key for matching imported requests when portable uuids regenerate.
 *
 * Postman/OpenCollection/Bruno converters mint new request uuids on every convert, so URL
 * refresh must fall back to folder + method + name + url identity.
 *
 * @param folderId - Resolved folder id, or null at collection root.
 * @param method - HTTP method.
 * @param name - Request display name.
 * @param url - Request URL.
 * @returns Stable fingerprint string for map keys.
 */
export function requestImportFingerprint(
  folderId: number | null,
  method: string,
  name: string,
  url: string
): string {
  return `${folderId ?? ''}\0${method}\0${name}\0${url}`;
}

/**
 * Builds a fingerprint key that ignores folder placement.
 *
 * Used when import folder resolution fails (regenerated folder uuids) so a refresh can still
 * update the existing row instead of inserting a duplicate at collection root.
 *
 * @param method - HTTP method.
 * @param name - Request display name.
 * @param url - Request URL.
 * @returns Stable fingerprint string for map keys.
 */
export function requestImportIdentityFingerprint(
  method: string,
  name: string,
  url: string
): string {
  return `${method}\0${name}\0${url}`;
}

/**
 * Builds folder-scoped and collection-scoped request fingerprint indexes for import upsert.
 *
 * @param requests - Requests already stored in the target collection.
 * @returns Fingerprint maps keyed for {@link resolveImportRequestId}.
 */
export function buildRequestFingerprintIndexes(requests: SavedRequest[]): {
  byFolder: Map<string, number>;
  byIdentity: Map<string, number>;
  folderIdByRequestId: Map<number, number | null>;
} {
  const byFolder = new Map<string, number>();
  const byIdentity = new Map<string, number>();
  const folderIdByRequestId = new Map<number, number | null>();
  for (const request of requests) {
    const folderId = request.folder_id ?? null;
    folderIdByRequestId.set(request.id, folderId);
    const folderKey = requestImportFingerprint(folderId, request.method, request.name, request.url);
    if (!byFolder.has(folderKey)) {
      byFolder.set(folderKey, request.id);
    }
    const identityKey = requestImportIdentityFingerprint(request.method, request.name, request.url);
    if (!byIdentity.has(identityKey)) {
      byIdentity.set(identityKey, request.id);
    }
  }
  return { byFolder, byIdentity, folderIdByRequestId };
}

/**
 * Resolves which existing request an imported row should update.
 *
 * Match order:
 * 1. Portable uuid
 * 2. Folder-scoped method + name + url (same placement)
 * 3. Collection-scoped method + name + url when folder resolution returned null
 *    (Postman refresh lost the folder link — update in place instead of duplicating at root)
 *
 * @param uuid - Resolved import uuid for the request row.
 * @param folderId - Folder id resolved from the import payload, or null.
 * @param method - HTTP method from the import row.
 * @param name - Display name from the import row.
 * @param url - URL from the import row.
 * @param requestUuidIndex - Existing uuid → id map.
 * @param fingerprints - Fingerprint indexes from {@link buildRequestFingerprintIndexes}.
 * @returns Local request id to update, or undefined to insert.
 */
export function resolveImportRequestId(
  uuid: string,
  folderId: number | null,
  method: string,
  name: string,
  url: string,
  requestUuidIndex: Map<string, number>,
  fingerprints: {
    byFolder: Map<string, number>;
    byIdentity: Map<string, number>;
  }
): number | undefined {
  const trimmedUuid = uuid.trim();
  if (trimmedUuid) {
    const byUuid = requestUuidIndex.get(trimmedUuid);
    if (byUuid != null) {
      return byUuid;
    }
  }

  const byFolder = fingerprints.byFolder.get(requestImportFingerprint(folderId, method, name, url));
  if (byFolder != null) {
    return byFolder;
  }

  if (folderId == null) {
    return fingerprints.byIdentity.get(requestImportIdentityFingerprint(method, name, url));
  }

  return undefined;
}

/**
 * Chooses the folder id to persist when upserting an imported request.
 *
 * When the import resolves a folder, that placement wins (remote structure is authoritative).
 * When resolution fails (null) but an existing row is being updated, keep the existing folder
 * so Postman/OpenCollection refresh does not yank requests to collection root.
 *
 * @param importedFolderId - Folder id resolved from the import payload.
 * @param existingFolderId - Folder id already stored on the matched request, if any.
 * @returns Folder id to write, or null for collection root.
 */
export function resolveUpsertRequestFolderId(
  importedFolderId: number | null,
  existingFolderId: number | null | undefined
): number | null {
  if (importedFolderId != null) {
    return importedFolderId;
  }
  if (existingFolderId != null) {
    return existingFolderId;
  }
  return null;
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
      marker: string | null;
    }
  | {
      action: 'insert';
      name: string;
      sort_order: number;
      uuid: string;
      marker: string | null;
    };

/**
 * Determines whether an exported folder row updates an existing folder or inserts a new one.
 *
 * Match order:
 * 1. Portable uuid when present and already stored
 * 2. Sibling-scoped name under the resolved parent (covers Postman/OpenCollection
 *    refresh, which regenerates folder uuids on every convert)
 * 3. Legacy global name when the export row omits uuid
 *
 * @param folder - Exported folder row from a collection file.
 * @param maps - Current folder uuid and name indexes for the target collection.
 * @param parentFolderId - Resolved parent folder id, or null at collection root.
 * @returns Upsert plan for the backend to execute.
 */
export function planImportedFolderUpsert(
  folder: ExportedFolder,
  maps: FolderImportMaps,
  parentFolderId: number | null = null
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
        marker: serializeSidebarMarker(folder.marker)
      };
    }
  }

  const siblingKey = folderSiblingNameKey(parentFolderId, folder.name);
  const existingBySiblingName = maps.folderIdByParentAndName.get(siblingKey);
  if (existingBySiblingName != null) {
    return {
      action: 'update',
      existingId: existingBySiblingName,
      name: folder.name,
      sort_order: folder.sort_order,
      // Keep the import uuid in the plan so callers can register it for child/request
      // resolution while still persisting the local uuid on update.
      uuid: hasFileUuid
        ? resolvedUuid
        : (maps.folderUuidById.get(existingBySiblingName) ?? resolvedUuid),
      marker: serializeSidebarMarker(folder.marker)
    };
  }

  if (!hasFileUuid) {
    const existingByName = maps.folderIdByName.get(folder.name);
    if (existingByName != null) {
      return {
        action: 'update',
        existingId: existingByName,
        name: folder.name,
        sort_order: folder.sort_order,
        uuid: maps.folderUuidById.get(existingByName) ?? resolvedUuid,
        marker: serializeSidebarMarker(folder.marker)
      };
    }
  }

  return {
    action: 'insert',
    name: folder.name,
    sort_order: folder.sort_order,
    uuid: resolvedUuid,
    marker: serializeSidebarMarker(folder.marker)
  };
}

/**
 * Registers a folder id in import maps after insert or update.
 *
 * @param maps - Folder import maps to mutate.
 * @param folderId - Local folder id that was inserted or updated.
 * @param name - Folder display name.
 * @param uuid - Folder portable uuid (import uuid and/or persisted local uuid).
 * @param parentFolderId - Parent folder id, or null at collection root.
 */
export function registerImportedFolderInMaps(
  maps: FolderImportMaps,
  folderId: number,
  name: string,
  uuid: string,
  parentFolderId: number | null = null
): void {
  maps.folderIdByUuid.set(uuid, folderId);
  maps.folderIdByName.set(name, folderId);
  maps.folderUuidById.set(folderId, uuid);

  const previousSiblingKey = maps.folderParentAndNameById.get(folderId);
  const siblingKey = folderSiblingNameKey(parentFolderId, name);
  if (previousSiblingKey != null && previousSiblingKey !== siblingKey) {
    if (maps.folderIdByParentAndName.get(previousSiblingKey) === folderId) {
      maps.folderIdByParentAndName.delete(previousSiblingKey);
    }
  }
  maps.folderIdByParentAndName.set(siblingKey, folderId);
  maps.folderParentAndNameById.set(folderId, siblingKey);
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
    marker: document.marker ?? null
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
  marker: string | null;
} {
  return {
    name: document.name,
    content: document.content,
    sort_order: document.sort_order,
    uuid: resolveImportedDocumentUuid(document),
    marker: serializeSidebarMarker(document.marker)
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
    ...(request.protocol === 'sse' ? { protocol: 'sse' as const } : {}),
    method: request.method,
    url: request.url,
    headers: request.headers,
    userAgent: request.userAgent,
    params: request.params,
    auth: request.auth,
    body: request.body,
    body_type: request.body_type,
    body_raw: request.body_raw ?? null,
    body_raw_open: request.body_raw_open === true,
    pre_request_script: request.pre_request_script,
    post_request_script: request.post_request_script,
    pre_request_scripts: request.pre_request_scripts,
    post_request_scripts: request.post_request_scripts,
    comment: request.comment,
    tags: request.tags,
    sort_order: request.sort_order,
    folder_name: folderName,
    folder_uuid: folderUuid,
    marker: request.marker ?? null
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
 * Sorts exported folders so every parent row appears before its descendants.
 *
 * Rows whose parent uuid is missing from the export are imported as collection-root folders.
 *
 * @param folders - Folder rows from a collection export payload.
 * @returns The same folders in parent-before-child order.
 */
export function orderExportedFoldersForImport(
  folders: readonly ExportedFolder[]
): ExportedFolder[] {
  const byUuid = new Map<string, ExportedFolder>();
  for (const folder of folders) {
    const uuid = folder.uuid?.trim();
    if (uuid) {
      byUuid.set(uuid, folder);
    }
  }

  const sorted: ExportedFolder[] = [];
  const visited = new Set<ExportedFolder>();
  const visiting = new Set<ExportedFolder>();

  /**
   * Visits a folder after its exported parent so inserts can resolve parent ids.
   *
   * @param folder - Folder row to append once ancestors are processed.
   */
  function visit(folder: ExportedFolder): void {
    if (visited.has(folder)) {
      return;
    }
    if (visiting.has(folder)) {
      sorted.push(folder);
      visited.add(folder);
      return;
    }

    visiting.add(folder);
    const parentUuid = folder.parent_folder_uuid?.trim();
    if (parentUuid) {
      const parent = byUuid.get(parentUuid);
      if (parent) {
        visit(parent);
      }
    }
    visiting.delete(folder);
    visited.add(folder);
    sorted.push(folder);
  }

  for (const folder of folders) {
    visit(folder);
  }

  return sorted;
}

/**
 * Resolves a folder's parent id from an exported parent uuid during import.
 *
 * @param folder - Exported folder row being inserted or updated.
 * @param folderIdByUuid - Map of folder uuid to local folder id built during import.
 * @returns Local parent folder id, or null for collection root.
 */
export function resolveImportedFolderParentId(
  folder: ExportedFolder,
  folderIdByUuid: Map<string, number>
): number | null {
  const parentUuid = folder.parent_folder_uuid?.trim();
  if (!parentUuid) {
    return null;
  }
  return folderIdByUuid.get(parentUuid) ?? null;
}

/**
 * Converts a persisted folder row into a portable export shape.
 *
 * @param folder - Folder loaded from storage.
 * @param parentFolderUuid - Portable uuid of the parent folder, or null at collection root.
 * @returns Portable folder export row.
 */
export function exportedFolderFromFolder(
  folder: Folder,
  parentFolderUuid: string | null = null
): ExportedFolder {
  return {
    uuid: folder.uuid,
    name: folder.name,
    parent_folder_uuid: parentFolderUuid,
    sort_order: folder.sort_order,
    variables: maskVariablesForExport(folder.variables),
    headers: folder.headers,
    userAgent: folder.userAgent,
    auth: folder.auth,
    pre_request_script: folder.pre_request_script,
    post_request_script: folder.post_request_script,
    pre_request_scripts: folder.pre_request_scripts,
    post_request_scripts: folder.post_request_scripts,
    marker: folder.marker ?? null
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
  userAgent: string;
  pre_request_script: string;
  post_request_script: string;
  pre_request_scripts_json: string;
  post_request_scripts_json: string;
  marker: string | null;
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
    userAgent: typeof folder.userAgent === 'string' ? folder.userAgent : '',
    pre_request_script: preScripts.legacy,
    post_request_script: postScripts.legacy,
    pre_request_scripts_json: preScripts.json,
    post_request_scripts_json: postScripts.json,
    marker: serializeSidebarMarker(folder.marker)
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
  userAgent: string;
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
    userAgent: typeof folder.userAgent === 'string' ? folder.userAgent : '',
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
  userAgent: string;
  auth: AuthConfig;
  pre_request_script: string;
  post_request_script: string;
  pre_request_scripts: ScriptRef[];
  post_request_scripts: ScriptRef[];
  marker: string | null;
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
    userAgent: typeof folder.userAgent === 'string' ? folder.userAgent : '',
    auth: folder.auth ?? defaultAuth(),
    pre_request_script: preScripts.legacy,
    post_request_script: postScripts.legacy,
    pre_request_scripts: preRefs,
    post_request_scripts: postRefs,
    marker: serializeSidebarMarker(folder.marker)
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
  protocol: 'http' | 'sse';
  url: string;
  headersJson: string;
  userAgent: string;
  paramsJson: string;
  authJson: string;
  body: string;
  body_type: ExportedRequest['body_type'];
  body_raw: string | null;
  body_raw_open: boolean;
  pre_request_script: string;
  post_request_script: string;
  pre_request_scripts_json: string;
  post_request_scripts_json: string;
  comment: string;
  tags: string;
  sort_order: number;
  uuid: string;
  marker: string | null;
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
    protocol: request.protocol === 'sse' ? 'sse' : 'http',
    url: request.url,
    headersJson: JSON.stringify(request.headers),
    userAgent: typeof request.userAgent === 'string' ? request.userAgent : '',
    paramsJson: JSON.stringify(request.params),
    authJson: JSON.stringify(request.auth ?? defaultAuth()),
    body: request.body,
    body_type: request.body_type,
    body_raw: request.body_raw ?? null,
    body_raw_open: request.body_raw_open === true,
    pre_request_script: preScripts.legacy,
    post_request_script: postScripts.legacy,
    pre_request_scripts_json: preScripts.json,
    post_request_scripts_json: postScripts.json,
    comment: request.comment,
    tags: normalizeRequestTags(request.tags),
    sort_order: request.sort_order,
    uuid: resolveImportedRequestUuid(request),
    marker: serializeSidebarMarker(request.marker)
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
