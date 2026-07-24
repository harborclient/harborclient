import type {
  Collection,
  CollectionDocument,
  GitRequestDiffFileEntry,
  SavedRequest
} from '#/shared/types';

/**
 * Resolved collections-sidebar row for one git change file.
 */
export interface GitChangeSidebarTarget {
  /**
   * Parent collection database id.
   */
  collectionId: number;

  /**
   * Parent folder id when the item lives inside a folder.
   */
  folderId: number | null;

  /**
   * HarborClient resource kind for the matched sidebar row.
   */
  kind: 'request' | 'document';

  /**
   * Saved request or document database id.
   */
  id: number;
}

/**
 * Collections cache inputs used to resolve a git change path to a sidebar row.
 */
export interface GitChangeSidebarLookupInput {
  /**
   * Collections currently loaded in the store.
   */
  collections: Collection[];

  /**
   * Saved requests keyed by collection id.
   */
  requestsByCollection: Record<number, SavedRequest[]>;

  /**
   * Markdown documents keyed by collection id.
   */
  documentsByCollection: Record<number, CollectionDocument[]>;
}

/**
 * Returns the final path segment from a repository-relative git file path.
 *
 * @param filePath - Repository-relative path under the HarborClient tree.
 */
export function gitChangePathBasename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  return segments[segments.length - 1] ?? '';
}

/**
 * Parses a request uuid from a canonical on-disk request file name.
 *
 * @param fileName - Basename such as `req-<uuid>.json`.
 */
export function parseRequestUuidFromGitFileName(fileName: string): string | null {
  const match = /^req-(.+)\.json$/i.exec(fileName);
  return match?.[1] ?? null;
}

/**
 * Resolves the sidebar document label for a git change row.
 *
 * Prefers enriched display names from the diff payload so harbor-root
 * disambiguated filenames still match the collection sidebar entry.
 *
 * @param file - Changed file entry from the git diff payload.
 * @returns Normalized markdown display name to match against document rows.
 */
function resolveDocumentMatchName(file: GitRequestDiffFileEntry): string {
  const enriched = file.displayName?.trim();
  if (enriched) {
    return enriched.toLowerCase().endsWith('.md') ? enriched : `${enriched}.md`;
  }
  return gitChangePathBasename(file.path);
}

/**
 * Resolves one git change row to a collections-sidebar target when the item still exists.
 *
 * Document rows prefer the enriched `displayName` (sidebar title) so disambiguated
 * on-disk names like `README-api.md` still resolve to a document named `README.md`.
 *
 * @param file - Changed file entry from the git diff payload.
 * @param collectionUuid - Stable uuid for the active git-backed collection.
 * @param input - Collections cache from the renderer store.
 * @returns Sidebar focus target, or null when the item cannot be matched.
 */
export function resolveGitChangeSidebarTarget(
  file: GitRequestDiffFileEntry,
  collectionUuid: string,
  input: GitChangeSidebarLookupInput
): GitChangeSidebarTarget | null {
  if (file.resourceKind !== 'request' && file.resourceKind !== 'document') {
    return null;
  }

  const collection = input.collections.find((entry) => entry.uuid === collectionUuid);
  if (collection == null) {
    return null;
  }

  if (file.resourceKind === 'request') {
    const requestUuid = parseRequestUuidFromGitFileName(gitChangePathBasename(file.path));
    if (requestUuid == null) {
      return null;
    }

    const request = (input.requestsByCollection[collection.id] ?? []).find(
      (entry) => entry.uuid === requestUuid
    );
    if (request == null) {
      return null;
    }

    return {
      collectionId: collection.id,
      folderId: request.folder_id ?? null,
      kind: 'request',
      id: request.id
    };
  }

  const documentName = resolveDocumentMatchName(file);
  const document = (input.documentsByCollection[collection.id] ?? []).find(
    (entry) => entry.name.localeCompare(documentName, undefined, { sensitivity: 'accent' }) === 0
  );
  if (document == null) {
    return null;
  }

  return {
    collectionId: collection.id,
    folderId: document.folder_id ?? null,
    kind: 'document',
    id: document.id
  };
}
