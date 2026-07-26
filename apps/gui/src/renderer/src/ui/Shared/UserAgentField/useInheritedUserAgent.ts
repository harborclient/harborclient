import { useMemo } from 'react';
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
 * Resolves the User-Agent inherited from parent scopes for an empty override.
 *
 * Chain is folder → collection → general settings, depending on which ids are
 * provided. Collection settings omit both ids so only the global default applies.
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
    const folder =
      folderId != null && collectionId != null
        ? (foldersByCollection[collectionId] ?? []).find((entry) => entry.id === folderId)
        : undefined;

    return (
      resolveEffectiveUserAgent({
        folder: folder?.userAgent,
        collection: collection?.userAgent,
        general: generalUserAgent
      }) ?? ''
    );
  }, [collectionId, collections, folderId, foldersByCollection, generalUserAgent]);
}
