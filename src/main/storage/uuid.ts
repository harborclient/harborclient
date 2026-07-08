import { randomUUID } from 'crypto';
import type {
  CollectionExport,
  EnvironmentExport,
  ExportedRequest,
  RequestExport
} from '#/shared/types';
import type { SnippetExport } from '#/shared/types/snippet';

/**
 * Returns a copy of a snippet export with a fresh uuid.
 *
 * @param data - Validated snippet export payload.
 * @returns A shallow copy with a new uuid assigned.
 */
export function mintFreshSnippetExportUuid(data: SnippetExport): SnippetExport {
  return {
    ...data,
    uuid: generateDocumentUuid()
  };
}

/**
 * Generates a new RFC 4122 UUID v4 for a document.
 *
 * @returns A new unique identifier string.
 */
export function generateDocumentUuid(): string {
  return randomUUID();
}

/**
 * Returns the payload uuid when present, otherwise mints a new one.
 *
 * @param uuid - Optional uuid from an import or export payload.
 * @returns A non-empty uuid string.
 */
export function resolveImportUuid(uuid: string | undefined): string {
  return uuid?.trim() ? uuid.trim() : generateDocumentUuid();
}

/**
 * Returns a copy of a collection export with fresh uuids for the collection, folders, and requests.
 *
 * Used when the user chooses "Import as new copy" so future imports do not collide.
 * Request `folder_uuid` values are rewritten to match reminted folder uuids.
 *
 * @param data - Validated collection export payload.
 * @returns A shallow copy with new uuids assigned.
 */
export function mintFreshCollectionExportUuids(data: CollectionExport): CollectionExport {
  const folderUuidByOldUuid = new Map<string, string>();
  const folders = (data.folders ?? []).map((folder) => {
    const newUuid = generateDocumentUuid();
    if (folder.uuid?.trim()) {
      folderUuidByOldUuid.set(folder.uuid.trim(), newUuid);
    }
    return {
      ...folder,
      uuid: newUuid
    };
  });

  const requests = data.requests.map((request) => {
    const oldFolderUuid = request.folder_uuid?.trim();
    const remappedFolderUuid =
      oldFolderUuid != null
        ? (folderUuidByOldUuid.get(oldFolderUuid) ?? null)
        : request.folder_uuid;

    return {
      ...request,
      uuid: generateDocumentUuid(),
      folder_uuid: remappedFolderUuid
    };
  });

  return {
    ...data,
    uuid: generateDocumentUuid(),
    folders,
    requests
  };
}

/**
 * Returns a copy of a single-request export with a fresh uuid.
 *
 * @param data - Validated request export payload.
 * @returns A shallow copy with a new uuid.
 */
export function mintFreshRequestExportUuid(data: RequestExport): RequestExport {
  return {
    ...data,
    uuid: generateDocumentUuid()
  };
}

/**
 * Returns a copy of an environment export with a fresh uuid.
 *
 * @param data - Validated environment export payload.
 * @returns A shallow copy with a new uuid.
 */
export function mintFreshEnvironmentExportUuid(data: EnvironmentExport): EnvironmentExport {
  return {
    ...data,
    uuid: generateDocumentUuid()
  };
}

/**
 * Returns a copy of an exported request row with a fresh uuid.
 *
 * @param request - Exported request row within a collection file.
 * @returns A shallow copy with a new uuid.
 */
export function mintFreshExportedRequestUuid(request: ExportedRequest): ExportedRequest {
  return {
    ...request,
    uuid: generateDocumentUuid()
  };
}
