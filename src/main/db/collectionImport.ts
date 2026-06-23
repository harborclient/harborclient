import { defaultAuth } from '#/shared/auth';
import type {
  CollectionExport,
  ExportedFolder,
  ExportedRequest,
  Folder,
  SavedRequest
} from '#/shared/types';
import { resolveImportUuid } from '#/main/db/uuid';

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
  }
  | {
    action: 'insert';
    name: string;
    sort_order: number;
    uuid: string;
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
        uuid: resolvedUuid
      };
    }

    return {
      action: 'insert',
      name: folder.name,
      sort_order: folder.sort_order,
      uuid: resolvedUuid
    };
  }

  const existingByName = maps.folderIdByName.get(folder.name);
  if (existingByName != null) {
    return {
      action: 'update',
      existingId: existingByName,
      name: folder.name,
      sort_order: folder.sort_order,
      uuid: maps.folderUuidById.get(existingByName) ?? resolvedUuid
    };
  }

  return {
    action: 'insert',
    name: folder.name,
    sort_order: folder.sort_order,
    uuid: resolvedUuid
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
  comment: string;
  sort_order: number;
  uuid: string;
} {
  return {
    name: request.name,
    method: request.method,
    url: request.url,
    headersJson: JSON.stringify(request.headers),
    paramsJson: JSON.stringify(request.params),
    authJson: JSON.stringify(request.auth ?? defaultAuth()),
    body: request.body,
    body_type: request.body_type,
    pre_request_script: request.pre_request_script,
    post_request_script: request.post_request_script,
    comment: request.comment,
    sort_order: request.sort_order,
    uuid: resolveImportedRequestUuid(request)
  };
}
