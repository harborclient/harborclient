import type { Collection, Folder, SavedRequest, TeamHubNotice } from '@harborclient/core/types';
import type { AppDispatch } from '#/renderer/src/store/redux';
import { openPageTab, setPageFocusSection } from '#/renderer/src/store/slices/tabsSlice';
import { requestLoadRequest } from '#/renderer/src/store/thunks/requests';
import { openRunResultByUuid } from '#/renderer/src/store/thunks/runResults';

interface NavigateContext {
  /**
   * Collections currently loaded in the sidebar.
   */
  collections: Collection[];

  /**
   * Saved requests keyed by collection id.
   */
  requestsByCollection: Record<number, SavedRequest[]>;

  /**
   * Folders keyed by collection id.
   */
  foldersByCollection: Record<number, Folder[]>;
}

/**
 * Finds a collection belonging to the given Team Hub connection by server UUID.
 *
 * @param collections - Loaded collections from Redux.
 * @param connectionId - Team Hub connection id.
 * @param collectionUuid - Server collection UUID, when known.
 */
function findCollectionByUuid(
  collections: Collection[],
  connectionId: string,
  collectionUuid?: string | null
): Collection | undefined {
  if (collectionUuid) {
    const match = collections.find(
      (entry) => entry.connectionId === connectionId && entry.uuid === collectionUuid
    );
    if (match) {
      return match;
    }
  }

  return collections.find((entry) => entry.connectionId === connectionId);
}

/**
 * Finds a saved request by server UUID within a hub connection.
 *
 * @param context - Collection and request lookup tables.
 * @param connectionId - Team Hub connection id.
 * @param requestUuid - Server request UUID.
 */
function findRequestByUuid(
  context: NavigateContext,
  connectionId: string,
  requestUuid: string
): SavedRequest | undefined {
  for (const collection of context.collections) {
    if (collection.connectionId !== connectionId) {
      continue;
    }
    const match = (context.requestsByCollection[collection.id] ?? []).find(
      (request) => request.uuid === requestUuid
    );
    if (match) {
      return match;
    }
  }
  return undefined;
}

/**
 * Finds a folder by server UUID within a hub connection.
 *
 * @param context - Collection and folder lookup tables.
 * @param connectionId - Team Hub connection id.
 * @param folderUuid - Server folder UUID.
 */
function findFolderByUuid(
  context: NavigateContext,
  connectionId: string,
  folderUuid: string
): { collectionId: number; folderId: number } | undefined {
  for (const collection of context.collections) {
    if (collection.connectionId !== connectionId) {
      continue;
    }
    const match = (context.foldersByCollection[collection.id] ?? []).find(
      (folder) => folder.uuid === folderUuid
    );
    if (match) {
      return { collectionId: collection.id, folderId: match.id };
    }
  }
  return undefined;
}

/**
 * Navigates to the entity referenced by a Team Hub notice.
 *
 * Opens the relevant request, collection, folder, or run result and focuses the
 * Discuss surface when applicable.
 *
 * @param dispatch - Redux dispatch function.
 * @param hubId - Team Hub connection id that produced the notice.
 * @param notice - Notice row selected by the user.
 * @param context - Lookup tables for resolving server UUIDs to local ids.
 */
export async function navigateTeamHubNotice(
  dispatch: AppDispatch,
  hubId: string,
  notice: TeamHubNotice,
  context: NavigateContext
): Promise<boolean> {
  switch (notice.entityType) {
    case 'request': {
      const requestUuid = notice.requestId ?? notice.entityId;
      const request = findRequestByUuid(context, hubId, requestUuid);
      if (!request) {
        return false;
      }
      await dispatch(requestLoadRequest({ req: request, skipSettingsCheck: true }));
      if (request.id != null) {
        await window.api.setRequestEditorTab(String(request.id), 'comment');
      }
      return true;
    }
    case 'collection': {
      const collection = findCollectionByUuid(
        context.collections,
        hubId,
        notice.collectionId ?? notice.entityId
      );
      if (!collection) {
        return false;
      }
      dispatch(openPageTab({ type: 'collection', id: collection.id, focusSection: 'discuss' }));
      return true;
    }
    case 'folder': {
      const folderUuid = notice.folderId ?? notice.entityId;
      const folder = findFolderByUuid(context, hubId, folderUuid);
      if (!folder) {
        return false;
      }
      dispatch(
        openPageTab({
          type: 'folder',
          collectionId: folder.collectionId,
          id: folder.folderId,
          focusSection: 'discuss'
        })
      );
      return true;
    }
    case 'runResult': {
      const runResultUuid = notice.runResultId ?? notice.entityId;
      try {
        await dispatch(openRunResultByUuid(runResultUuid)).unwrap();
        return true;
      } catch {
        return false;
      }
    }
  }
}

/**
 * Applies a page-tab focus section after navigation when the tab already exists.
 *
 * @param dispatch - Redux dispatch function.
 * @param tabId - Open page tab id to update.
 * @param focusSection - Segmented tab section to focus.
 */
export function focusPageDiscussSection(
  dispatch: AppDispatch,
  tabId: string,
  focusSection: string
): void {
  dispatch(setPageFocusSection({ tabId, focusSection }));
}
