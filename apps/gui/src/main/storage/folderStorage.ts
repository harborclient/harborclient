import { getFolderDescendants, wouldCreateFolderCycle } from '@harborclient/core/folderTree';
import type { ExportedFolder, Folder } from '@harborclient/core/types';
import { exportedFolderFromFolder } from './collectionImport';

/**
 * Maps persisted folders to portable export rows including parent uuid references.
 *
 * @param folders - Flat folder list for one collection.
 * @returns Export rows with {@link ExportedFolder.parent_folder_uuid} populated.
 */
export function exportFoldersWithParents(folders: Folder[]): ExportedFolder[] {
  const folderUuidById = new Map(folders.map((folder) => [folder.id, folder.uuid]));
  return folders.map((folder) => ({
    ...exportedFolderFromFolder(folder),
    parent_folder_uuid:
      folder.parent_folder_id != null ? (folderUuidById.get(folder.parent_folder_id) ?? null) : null
  }));
}

/**
 * Sorts exported folders so parents appear before children during import.
 *
 * @param folders - Exported folder rows from a collection file.
 * @returns The same folders in dependency-safe insert order.
 */
export function sortExportedFoldersParentFirst(
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
  const visited = new Set<string>();

  /**
   * Visits a folder after its exported parent row when one is present.
   *
   * @param folder - Exported folder row to append once ancestors are visited.
   */
  function visit(folder: ExportedFolder): void {
    const uuid = folder.uuid?.trim();
    if (!uuid || visited.has(uuid)) {
      return;
    }
    const parentUuid = folder.parent_folder_uuid?.trim();
    if (parentUuid && byUuid.has(parentUuid)) {
      visit(byUuid.get(parentUuid)!);
    }
    visited.add(uuid);
    sorted.push(folder);
  }

  for (const folder of folders) {
    visit(folder);
  }
  return sorted;
}

/**
 * Resolves a parent folder database id from an exported parent uuid.
 *
 * @param parentFolderUuid - Portable parent uuid from an export row.
 * @param folderIdByUuid - Uuid index built during import.
 * @returns Parent folder id, or null for collection root.
 */
export function resolveImportParentFolderId(
  parentFolderUuid: string | null | undefined,
  folderIdByUuid: ReadonlyMap<string, number>
): number | null {
  if (parentFolderUuid == null || parentFolderUuid.trim() === '') {
    return null;
  }
  return folderIdByUuid.get(parentFolderUuid.trim()) ?? null;
}

/**
 * Returns the highest sort_order among sibling folders sharing a parent.
 *
 * @param folders - Flat folders for the collection.
 * @param parentFolderId - Parent folder id, or null for collection-root siblings.
 * @returns Maximum sibling sort_order, or -1 when there are no siblings.
 */
export function maxSiblingFolderSortOrder(
  folders: readonly Folder[],
  parentFolderId: number | null
): number {
  return folders
    .filter((folder) => (folder.parent_folder_id ?? null) === parentFolderId)
    .reduce((max, folder) => Math.max(max, folder.sort_order), -1);
}

/**
 * Validates folder ids for sibling reorder and throws when any id is out of scope.
 *
 * @param folders - Flat folders for the collection.
 * @param collectionId - Owning collection id.
 * @param parentFolderId - Expected parent for every reordered folder.
 * @param orderedFolderIds - Folder ids in desired sibling order.
 */
export function assertFolderSiblingReorder(
  folders: readonly Folder[],
  collectionId: number,
  parentFolderId: number | null,
  orderedFolderIds: readonly number[]
): void {
  for (const folderId of orderedFolderIds) {
    const folder = folders.find((candidate) => candidate.id === folderId);
    if (!folder || folder.collection_id !== collectionId) {
      throw new Error('Folder not found');
    }
    if ((folder.parent_folder_id ?? null) !== parentFolderId) {
      throw new Error('Folder not found');
    }
  }
}

/**
 * Validates that a parent folder belongs to the same collection.
 *
 * @param folders - Flat folders for the collection.
 * @param collectionId - Owning collection id.
 * @param parentFolderId - Proposed parent folder id, or null for collection root.
 * @throws When the parent folder is missing or belongs to another collection.
 */
export function assertValidFolderParent(
  folders: readonly Folder[],
  collectionId: number,
  parentFolderId: number | null
): void {
  if (parentFolderId == null) {
    return;
  }
  const parent = folders.find(
    (candidate) => candidate.id === parentFolderId && candidate.collection_id === collectionId
  );
  if (!parent) {
    throw new Error('Folder not found');
  }
}

/**
 * Returns folder ids in a subtree ordered deepest-first for safe deletion.
 *
 * @param folderId - Root folder id of the subtree to delete.
 * @param folders - Flat folders for the collection.
 * @returns Folder ids to delete, deepest descendants first.
 */
export function folderSubtreeIdsForDeletion(
  folderId: number,
  folders: readonly Folder[]
): number[] {
  const descendants = getFolderDescendants(folderId, folders);
  return [folderId, ...descendants.map((folder) => folder.id)].reverse();
}

/**
 * Sorts persisted folders so parents are created before children when copying collections.
 *
 * @param folders - Source folders with database ids and parent links.
 * @returns Folders in parent-first order.
 */
export function sortFoldersParentFirst(folders: readonly Folder[]): Folder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const sorted: Folder[] = [];
  const visited = new Set<number>();

  /**
   * Visits a folder after its persisted parent when one is present.
   *
   * @param folder - Folder row to append once ancestors are visited.
   */
  function visit(folder: Folder): void {
    if (visited.has(folder.id)) {
      return;
    }
    const parentId = folder.parent_folder_id;
    if (parentId != null && byId.has(parentId)) {
      visit(byId.get(parentId)!);
    }
    visited.add(folder.id);
    sorted.push(folder);
  }

  for (const folder of folders) {
    visit(folder);
  }
  return sorted;
}

export { wouldCreateFolderCycle };
