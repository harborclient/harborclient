import { useCallback } from 'react';
import { entryById, type SettingId } from '#/shared/search/settingsCatalog';
import { settingAnchorId } from '#/renderer/src/ui/Settings/settingAnchorId';
import { parseSidebarDocumentId } from '#/shared/search/sidebar';
import type { SidebarSearchInput } from '#/shared/search/sidebar';
import type { UnifiedSearchHit } from '#/shared/search/types';
import type { SavedRequest } from '#/shared/types';
import { useSearchIndexes } from '#/renderer/src/search/useSearchIndexes';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { setSelectedCollectionId } from '#/renderer/src/store/slices/collectionsSlice';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import { closeActionMenuModal } from '#/renderer/src/store/slices/modalsSlice';
import {
  setPendingInstalledSearch,
  setPendingMarketplaceSearch,
  setPendingSnippetMarketplaceSearch,
  setShowSidebar
} from '#/renderer/src/store/slices/navigationSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { focusSidebarItem, requestLoadRequest } from '#/renderer/src/store/thunks';
import { useSidebarExpansion } from '#/renderer/src/ui/sidebars/CollectionSidebar/useSidebarExpansion';

/**
 * Finds a saved request in the warm sidebar search input by numeric id.
 *
 * @param input - Sidebar entity data from the search index provider.
 * @param requestId - Database id of the saved request.
 */
function findSavedRequest(input: SidebarSearchInput, requestId: number): SavedRequest | null {
  for (const collection of input.collections) {
    for (const request of input.requestsByCollection[collection.id] ?? []) {
      if (request.id === requestId) {
        return request;
      }
    }
  }
  return null;
}

/**
 * Returns a hook that navigates to the target described by a unified search hit.
 */
export function useActivateSearchHit(): (hit: UnifiedSearchHit, query: string) => void {
  const dispatch = useAppDispatch();
  const { sidebarInput } = useSearchIndexes();
  const {
    revealCollection,
    revealFolder,
    setEnvironmentsSectionVisible,
    setEnvironmentsSectionExpanded
  } = useSidebarExpansion();

  return useCallback(
    (hit: UnifiedSearchHit, query: string) => {
      dispatch(closeActionMenuModal());

      switch (hit.domain) {
        case 'request': {
          const parsed = parseSidebarDocumentId(hit.id);
          if (parsed == null || parsed.kind !== 'request') {
            return;
          }
          const req = findSavedRequest(sidebarInput, parsed.entityId);
          if (req == null) {
            return;
          }
          void dispatch(requestLoadRequest({ req }));
          dispatch(focusSidebarItem({ collectionId: req.collection_id, folderId: req.folder_id }));
          if (req.folder_id != null) {
            revealFolder(req.collection_id, req.folder_id);
          } else {
            revealCollection(req.collection_id);
          }
          return;
        }
        case 'collection': {
          const parsed = parseSidebarDocumentId(hit.id);
          if (parsed == null || parsed.kind !== 'collection') {
            return;
          }
          dispatch(setShowSidebar(true));
          dispatch(setSelectedCollectionId(parsed.entityId));
          revealCollection(parsed.entityId);
          return;
        }
        case 'folder': {
          const parsed = parseSidebarDocumentId(hit.id);
          if (parsed == null || parsed.kind !== 'folder') {
            return;
          }
          const collectionId = hit.collectionId;
          if (collectionId == null) {
            return;
          }
          dispatch(setShowSidebar(true));
          dispatch(focusSidebarItem({ collectionId, folderId: parsed.entityId }));
          revealFolder(collectionId, parsed.entityId);
          return;
        }
        case 'environment': {
          const parsed = parseSidebarDocumentId(hit.id);
          if (parsed == null || parsed.kind !== 'environment') {
            return;
          }
          dispatch(setShowSidebar(true));
          dispatch(setActiveEnvironmentId(parsed.entityId));
          setEnvironmentsSectionVisible(true);
          setEnvironmentsSectionExpanded(true);
          return;
        }
        case 'setting': {
          const entry = entryById(hit.id as SettingId);
          if (entry.kind === 'group') {
            dispatch(
              openPageTab({
                type: 'settings',
                section: entry.section,
                focusSettingId: entry.id
              })
            );
            return;
          }
          if (entry.kind !== 'field') {
            return;
          }
          if (entry.section === 'plugins') {
            dispatch(openPageTab({ type: 'plugins' }));
            return;
          }
          dispatch(openPageTab({ type: 'settings', section: entry.section }));
          requestAnimationFrame(() => {
            document.getElementById(settingAnchorId(hit.id))?.focus();
          });
          return;
        }
        case 'plugin': {
          const searchValue = query.trim() || hit.title;
          if (hit.pluginListingSource === 'installed') {
            dispatch(openPageTab({ type: 'plugins' }));
            dispatch(setPendingInstalledSearch(searchValue));
            return;
          }
          dispatch(openPageTab({ type: 'plugins' }));
          dispatch(setPendingMarketplaceSearch(searchValue));
          return;
        }
        case 'theme': {
          const searchValue = query.trim() || hit.title;
          if (hit.pluginListingSource === 'installed') {
            dispatch(openPageTab({ type: 'themes' }));
            dispatch(setPendingInstalledSearch(searchValue));
            return;
          }
          dispatch(openPageTab({ type: 'themes' }));
          dispatch(setPendingMarketplaceSearch(searchValue));
          return;
        }
        case 'page': {
          if (hit.id === 'snippets') {
            dispatch(openPageTab({ type: 'snippets' }));
          }
          return;
        }
        case 'snippet': {
          const searchValue = query.trim() || hit.title;
          dispatch(openPageTab({ type: 'snippets' }));
          dispatch(setPendingSnippetMarketplaceSearch(searchValue));
          return;
        }
      }
    },
    [
      dispatch,
      revealCollection,
      revealFolder,
      setEnvironmentsSectionExpanded,
      setEnvironmentsSectionVisible,
      sidebarInput
    ]
  );
}
