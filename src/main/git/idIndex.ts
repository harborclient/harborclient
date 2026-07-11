import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Persisted uuid-to-numeric-id mappings for a git-backed provider.
 */
export interface GitIdIndexData {
  /**
   * Next numeric id to assign for collections.
   */
  nextCollectionId: number;

  /**
   * Next numeric id to assign for folders.
   */
  nextFolderId: number;

  /**
   * Next numeric id to assign for requests.
   */
  nextRequestId: number;

  /**
   * Next numeric id to assign for environments.
   */
  nextEnvironmentId: number;

  /**
   * Next numeric id to assign for snippets.
   */
  nextSnippetId: number;

  /**
   * Next numeric id to assign for markdown documents.
   */
  nextDocumentId: number;

  /**
   * Collection uuid to local numeric id.
   */
  collectionIds: Record<string, number>;

  /**
   * Folder uuid to local numeric id.
   */
  folderIds: Record<string, number>;

  /**
   * Request uuid to local numeric id.
   */
  requestIds: Record<string, number>;

  /**
   * Environment uuid to local numeric id.
   */
  environmentIds: Record<string, number>;

  /**
   * Snippet uuid to local numeric id.
   */
  snippetIds: Record<string, number>;

  /**
   * Markdown document uuid to local numeric id.
   */
  documentIds: Record<string, number>;
}

/**
 * Creates an empty id index with counters starting at 1.
 */
export function createEmptyGitIdIndex(): GitIdIndexData {
  return {
    nextCollectionId: 1,
    nextFolderId: 1,
    nextRequestId: 1,
    nextEnvironmentId: 1,
    nextSnippetId: 1,
    nextDocumentId: 1,
    collectionIds: {},
    folderIds: {},
    requestIds: {},
    environmentIds: {},
    snippetIds: {},
    documentIds: {}
  };
}

/**
 * Loads or creates a git id index file for a connection in userData.
 *
 * @param userDataPath - Electron userData directory.
 * @param connectionId - Git connection id.
 * @returns Parsed index data.
 */
export function loadGitIdIndex(userDataPath: string, connectionId: string): GitIdIndexData {
  const dir = join(userDataPath, 'git-index');
  const path = join(dir, `${connectionId}.json`);
  if (!existsSync(path)) {
    return createEmptyGitIdIndex();
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<GitIdIndexData>;
    return {
      nextCollectionId: parsed.nextCollectionId ?? 1,
      nextFolderId: parsed.nextFolderId ?? 1,
      nextRequestId: parsed.nextRequestId ?? 1,
      nextEnvironmentId: parsed.nextEnvironmentId ?? 1,
      nextSnippetId: parsed.nextSnippetId ?? 1,
      nextDocumentId: parsed.nextDocumentId ?? 1,
      collectionIds: parsed.collectionIds ?? {},
      folderIds: parsed.folderIds ?? {},
      requestIds: parsed.requestIds ?? {},
      environmentIds: parsed.environmentIds ?? {},
      snippetIds: parsed.snippetIds ?? {},
      documentIds: parsed.documentIds ?? {}
    };
  } catch {
    return createEmptyGitIdIndex();
  }
}

/**
 * Persists a git id index file for a connection.
 *
 * @param userDataPath - Electron userData directory.
 * @param connectionId - Git connection id.
 * @param data - Index data to write.
 */
export function saveGitIdIndex(
  userDataPath: string,
  connectionId: string,
  data: GitIdIndexData
): void {
  const dir = join(userDataPath, 'git-index');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${connectionId}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Assigns a stable numeric id for a uuid, reusing existing mappings when present.
 *
 * @param index - Mutable index data.
 * @param mapKey - Which entity map to update.
 * @param uuid - Stable document uuid.
 * @param nextKey - Counter field name for new assignments.
 * @returns Assigned numeric id.
 */
export function assignGitId(
  index: GitIdIndexData,
  mapKey:
    | 'collectionIds'
    | 'folderIds'
    | 'requestIds'
    | 'environmentIds'
    | 'snippetIds'
    | 'documentIds',
  nextKey:
    | 'nextCollectionId'
    | 'nextFolderId'
    | 'nextRequestId'
    | 'nextEnvironmentId'
    | 'nextSnippetId'
    | 'nextDocumentId',
  uuid: string
): number {
  const map = index[mapKey];
  const existing = map[uuid];
  if (existing != null) {
    return existing;
  }

  const id = index[nextKey];
  index[nextKey] = id + 1;
  map[uuid] = id;
  return id;
}

/**
 * Removes uuid mappings that are no longer present on disk.
 *
 * @param index - Mutable index data.
 * @param mapKey - Entity map to prune.
 * @param activeUuids - Uuids that still exist in the working tree.
 */
export function pruneGitIdMap(
  index: GitIdIndexData,
  mapKey:
    | 'collectionIds'
    | 'folderIds'
    | 'requestIds'
    | 'environmentIds'
    | 'snippetIds'
    | 'documentIds',
  activeUuids: Set<string>
): void {
  const map = index[mapKey];
  for (const uuid of Object.keys(map)) {
    if (!activeUuids.has(uuid)) {
      delete map[uuid];
    }
  }
}
