import type { Folder, SavedRequest } from '#/shared/types';

/**
 * Inputs for resolving a human-readable collection runner target label.
 */
export interface RunnerTargetRef {
  collectionId: number;
  folderId?: number | null;
  requestId?: number | null;
  requestIds?: number[] | null;
}

/**
 * Entity names used to build collection runner titles and tab labels.
 */
export interface RunnerTargetNames {
  collectionName: string;
  folderName: string | null;
  requestName: string | null;
}

/**
 * Resolves display names for a collection runner target from sidebar entities.
 *
 * @param target - Collection, folder, or request identity for the run.
 * @param collections - Available collections keyed by id lookup.
 * @param folders - Folders for the target collection.
 * @param requests - Saved requests for the target collection.
 * @returns Resolved names for titles and tab labels.
 */
export function resolveRunnerTargetNames(
  target: RunnerTargetRef,
  collections: { id: number; name: string }[],
  folders: Folder[],
  requests: SavedRequest[]
): RunnerTargetNames {
  const collectionName =
    collections.find((collection) => collection.id === target.collectionId)?.name ?? 'Collection';
  const folderName =
    target.folderId == null
      ? null
      : (folders.find((folder) => folder.id === target.folderId)?.name ?? 'Folder');
  const requestName =
    target.requestId == null
      ? null
      : (requests.find((request) => request.id === target.requestId)?.name ?? 'Request');

  return { collectionName, folderName, requestName };
}

/**
 * Returns the primary label for a collection runner target (request, folder, or collection).
 *
 * @param names - Resolved entity names for the run target.
 * @returns Short name shown in tab titles and page headers.
 */
export function runnerTargetLabel(names: RunnerTargetNames): string {
  if (names.requestName) {
    return names.requestName;
  }
  if (names.folderName) {
    return names.folderName;
  }
  return names.collectionName;
}

/**
 * Returns a full page heading for the collection runner target.
 *
 * @param names - Resolved entity names for the run target.
 * @returns Descriptive heading for the runner page.
 */
export function runnerPageTitle(names: RunnerTargetNames): string {
  if (names.requestName) {
    return `Run request "${names.requestName}" in "${names.collectionName}"`;
  }
  if (names.folderName) {
    return `Run folder "${names.folderName}" in "${names.collectionName}"`;
  }
  return `Run "${names.collectionName}"`;
}
