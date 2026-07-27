import { useMemo } from 'react';
import { getFolderAncestors } from '@harborclient/core/folderTree';
import type { Folder } from '@harborclient/core/types';
import { resolveEffectiveUserAgent } from '@harborclient/core/userAgent';

import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectCollections, selectFoldersByCollection } from '#/renderer/src/store/selectors';

interface Options {
  /**
   * When set, includes that collection's User-Agent in the parent chain
   * (folder and request editors).
   */
  collectionId?: number | null;

  /**
   * When set with {@link collectionId}, includes that folder's User-Agent
   * (request editor).
   */
  folderId?: number | null;
}

/**
 * Finds the nearest configured User-Agent from a folder through its ancestor chain.
 *
 * @param folderId - Current folder whose inheritance chain should be inspected.
 * @param folders - Folders loaded for the owning collection.
 * @returns Nearest non-empty folder User-Agent, or undefined when none is configured.
 */
export function resolveInheritedFolderUserAgent(
  folderId: number | null | undefined,
  folders: readonly Folder[]
): string | undefined {
  if (folderId == null) {
    return undefined;
  }

  const folder = folders.find((entry) => entry.id === folderId);
  if (folder == null) {
    return undefined;
  }

  for (const candidate of [folder, ...getFolderAncestors(folderId, folders)]) {
    const value = resolveEffectiveUserAgent({ folder: candidate.userAgent });
    if (value != null) {
      return value;
    }
  }
  return undefined;
}

/**
 * Resolves the User-Agent inherited from parent scopes for an empty override.
 *
 * Chain is current folder → ancestor folders → collection → general settings,
 * depending on which ids are provided. Collection settings omit both ids so only
 * the global default applies.
 *
 * @param options - Optional collection/folder ids that sit above the current scope.
 * @returns Effective parent User-Agent, or empty when none is configured.
 */
export function useInheritedUserAgent({ collectionId, folderId }: Options = {}): string {
  const generalUserAgent = useAppSelector((state) => state.settings.general.userAgent);
  const collections = useAppSelector(selectCollections);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);

  /**
   * Looks up parent-scope User-Agent strings and collapses them with the global default.
   */
  return useMemo(() => {
    const collection =
      collectionId != null ? collections.find((entry) => entry.id === collectionId) : undefined;
    const folderUserAgent =
      collectionId != null
        ? resolveInheritedFolderUserAgent(folderId, foldersByCollection[collectionId] ?? [])
        : undefined;

    return (
      resolveEffectiveUserAgent({
        folder: folderUserAgent,
        collection: collection?.userAgent,
        general: generalUserAgent
      }) ?? ''
    );
  }, [collectionId, collections, folderId, foldersByCollection, generalUserAgent]);
}
