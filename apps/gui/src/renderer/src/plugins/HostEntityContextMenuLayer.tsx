import { arrayMove } from '@dnd-kit/sortable';
import {
  mergeContainerItems,
  toContainerItemRefs,
  type ContainerItemRef
} from '@harborclient/core/collectionContainerOrder';
import { getFolderDescendants } from '@harborclient/core/folderTree';
import type {
  Collection,
  CollectionDocument,
  Folder,
  SavedRequest
} from '@harborclient/core/types';
import { useCopyToChat } from '#/renderer/src/hooks/useCopyToChat';
import type { EntityContextMenuOpenRequest } from '#/renderer/src/plugins/hostEntityContextMenu';
import { findSavedRequest } from '#/renderer/src/plugins/hostRequestCommands';
import { subscribePluginEntityContextMenuOpen } from '#/renderer/src/plugins/pluginEntityContextMenuBus';
import { store } from '#/renderer/src/store/redux';
import { useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveCollections,
  selectDocumentsByCollection,
  selectFoldersByCollection,
  selectRequestsByCollection,
  selectSelectedCollectionId,
  selectSelectedFolderId
} from '#/renderer/src/store/selectors';
import { useCollectionActions } from '#/renderer/src/ui/Sidebars/CollectionSidebar/actions/useCollectionActions';
import { ActionsMenu as CollectionActionsMenu } from '#/renderer/src/ui/Sidebars/CollectionSidebar/Collections/ActionsMenu';
import { FolderActionsMenu } from '#/renderer/src/ui/Sidebars/CollectionSidebar/Collections/FolderActionsMenu';
import { ActionsMenu as RequestActionsMenu } from '#/renderer/src/ui/Sidebars/CollectionSidebar/Collections/RequestRow/ActionsMenu';
import { countUntrackedCollectionItems } from '#/renderer/src/ui/Sidebars/CollectionSidebar/git/countUntrackedCollectionItems';
import { useSidebarGit } from '#/renderer/src/ui/Sidebars/CollectionSidebar/git/sidebarGitContext';
import {
  HC_PLUGIN_CONTRIBUTION_ATTR,
  HC_PLUGIN_ID_ATTR,
  HC_PLUGIN_SURFACE_ATTR
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/navigation/focusCollectionsReplacementPanel';
import { useSidebarProviders } from '#/renderer/src/ui/Sidebars/CollectionSidebar/providers/sidebarProvidersContext';
import { useCallback, useEffect, useState, type JSX } from 'react';

/**
 * Escapes a value for use inside a CSS attribute selector.
 *
 * @param value - Raw attribute value.
 * @returns Escaped value safe for `querySelector`.
 */
function escapeAttr(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Returns focus to the plugin webview that requested the entity context menu.
 *
 * @param pluginId - Plugin manifest id.
 * @param contributionId - Sidebar panel contribution id.
 */
function refocusPluginSurface(pluginId: string, contributionId: string): void {
  requestAnimationFrame(() => {
    const container = document.querySelector(
      `[${HC_PLUGIN_SURFACE_ATTR}][${HC_PLUGIN_ID_ATTR}="${escapeAttr(pluginId)}"][${HC_PLUGIN_CONTRIBUTION_ATTR}="${escapeAttr(contributionId)}"]`
    );
    if (container == null || !('querySelector' in container)) {
      return;
    }
    const webview = (container as ParentNode).querySelector('webview');
    if (webview != null && 'focus' in webview && typeof webview.focus === 'function') {
      (webview as HTMLElement).focus();
      return;
    }
    if ('focus' in container && typeof (container as HTMLElement).focus === 'function') {
      (container as HTMLElement).focus();
    }
  });
}

/**
 * Loads a saved request from storage when it is not present in the Redux cache.
 *
 * @param requestId - Saved request database id.
 * @returns Matching request.
 * @throws When the request cannot be found.
 */
async function loadRequestFromStorage(requestId: number): Promise<SavedRequest> {
  const { collections } = await window.api.listCollections();
  for (const collection of collections) {
    const requests = await window.api.listRequests(collection.id);
    const match = requests.find((request) => request.id === requestId);
    if (match) {
      return match;
    }
  }
  throw new Error(`Request ${requestId} was not found.`);
}

/**
 * Host-owned layer that shows built-in entity context menus for replacement sidebars.
 *
 * Subscribes to {@link subscribePluginEntityContextMenuOpen} and renders the same
 * collection/folder/request action menus the built-in tree uses, anchored at the
 * mapped host viewport coordinates. Works when the built-in Collections tree is
 * unmounted (replacement mode).
 */
export function HostEntityContextMenuLayer(): JSX.Element | null {
  const [openRequest, setOpenRequest] = useState<EntityContextMenuOpenRequest | null>(null);
  const [resolvedRequest, setResolvedRequest] = useState<SavedRequest | null>(null);
  const [requestLoadToken, setRequestLoadToken] = useState(0);

  const collections = useAppSelector(selectActiveCollections);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const documentsByCollection = useAppSelector(selectDocumentsByCollection);
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const selectedFolderId = useAppSelector(selectSelectedFolderId);
  const { primaryConnectionId, connectionNamesById, connectionTypesById } = useSidebarProviders();
  const { itemGitStatusByUuid } = useSidebarGit();
  const { aiAvailable, copyToChat } = useCopyToChat();
  const {
    onReorderCollections,
    onReorderFolders,
    onReorderContainerItems,
    onRunRequest,
    onDeleteRequest,
    onDuplicateRequest,
    onExportRequest,
    onRunSelectedRequests,
    onOpenSelectedRequests,
    onCreateWorkspaceFromSelection,
    onDeleteSelectedRequests
  } = useCollectionActions();

  /**
   * Subscribes to plugin-requested entity context menu opens for the sidebar lifetime.
   */
  useEffect(() => {
    return subscribePluginEntityContextMenuOpen((request) => {
      setResolvedRequest(null);
      setOpenRequest(request);
      if (request.target.type === 'request') {
        setRequestLoadToken((token) => token + 1);
      }
    }).dispose;
  }, []);

  /**
   * Resolves a request target from the store cache or storage when the menu opens.
   * Triggered by `requestLoadToken` so the async load is not driven by a sync
   * setState branch inside the effect for non-request targets.
   */
  useEffect(() => {
    if (openRequest?.target.type !== 'request' || requestLoadToken === 0) {
      return;
    }
    const requestId = openRequest.target.requestId;
    let cancelled = false;
    void (async () => {
      const cached = findSavedRequest(store.getState(), requestId);
      if (cached) {
        if (!cancelled) {
          setResolvedRequest(cached);
        }
        return;
      }
      try {
        const loaded = await loadRequestFromStorage(requestId);
        if (!cancelled) {
          setResolvedRequest(loaded);
        }
      } catch {
        if (!cancelled) {
          setOpenRequest(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openRequest, requestLoadToken]);

  /**
   * Dismisses the open menu and returns focus to the requesting plugin surface.
   */
  const handleDismiss = useCallback((): void => {
    if (openRequest != null) {
      refocusPluginSurface(openRequest.pluginId, openRequest.contributionId);
    }
    setOpenRequest(null);
    setResolvedRequest(null);
  }, [openRequest]);

  if (openRequest == null) {
    return null;
  }

  const { target, anchor } = openRequest;

  if (target.type === 'collection') {
    const collection = collections.find((entry) => entry.id === target.collectionId);
    if (collection == null) {
      return null;
    }
    const collectionIndex = collections.findIndex((entry) => entry.id === collection.id);
    const collectionConnectionId = collection.connectionId ?? primaryConnectionId;
    const connectionName = connectionNamesById[collectionConnectionId];
    const connectionType = connectionTypesById[collectionConnectionId];
    const canShare =
      connectionType != null && connectionType !== 'sqlite' && connectionType !== 'git';
    const untrackedItemCount =
      connectionType === 'git'
        ? countUntrackedCollectionItems(
            requestsByCollection[collection.id] ?? [],
            documentsByCollection[collection.id] ?? [],
            itemGitStatusByUuid
          )
        : 0;

    return (
      <CollectionActionsMenu
        collection={collection}
        collectionIndex={Math.max(0, collectionIndex)}
        collectionsCount={collections.length}
        inspectPoint={anchor}
        connectionType={connectionType}
        connectionName={connectionName}
        collectionConnectionId={collectionConnectionId}
        canShare={canShare}
        reorderEnabled
        onMove={(direction) => {
          void moveCollectionOrder(collections, collection.id, direction, onReorderCollections);
        }}
        hasDeselectableSelection={
          selectedCollectionId === collection.id ||
          (selectedFolderId != null &&
            (foldersByCollection[collection.id] ?? []).some(
              (folder) => folder.id === selectedFolderId
            ))
        }
        onDeselectAll={() => undefined}
        untrackedItemCount={untrackedItemCount}
        presentation="anchor"
        anchorPosition={anchor}
        onDismiss={handleDismiss}
      />
    );
  }

  if (target.type === 'folder') {
    const folders = foldersByCollection[target.collectionId] ?? [];
    const folder = folders.find((entry) => entry.id === target.folderId);
    const collection = collections.find((entry) => entry.id === target.collectionId);
    if (folder == null || collection == null) {
      return null;
    }
    const parentFolderId = folder.parent_folder_id ?? null;
    const siblings = folders.filter((entry) => (entry.parent_folder_id ?? null) === parentFolderId);
    const folderIndex = siblings.findIndex((entry) => entry.id === folder.id);
    const descendants = getFolderDescendants(folder.id, folders);
    const subtreeFolderIds = new Set([folder.id, ...descendants.map((d) => d.id)]);
    const subtreeRequestIds = (requestsByCollection[target.collectionId] ?? [])
      .filter((request) => request.folder_id != null && subtreeFolderIds.has(request.folder_id))
      .map((request) => request.id);

    return (
      <FolderActionsMenu
        collection={collection}
        folder={folder}
        folderIndex={Math.max(0, folderIndex)}
        foldersCount={siblings.length}
        subtreeRequestIds={subtreeRequestIds}
        descendantFolderCount={descendants.length}
        inspectPoint={anchor}
        reorderEnabled
        onMove={(direction) => {
          void moveFolderOrder(folders, folder, direction, (orderedIds) =>
            onReorderFolders(target.collectionId, parentFolderId, orderedIds)
          );
        }}
        presentation="anchor"
        anchorPosition={anchor}
        onDismiss={handleDismiss}
      />
    );
  }

  if (resolvedRequest == null) {
    return null;
  }

  const containerFolderId = resolvedRequest.folder_id ?? null;
  const containerItems = getContainerItemRefs(
    resolvedRequest.collection_id,
    containerFolderId,
    requestsByCollection,
    documentsByCollection
  );
  const itemIndex = containerItems.findIndex(
    (item) => item.kind === 'request' && item.id === resolvedRequest.id
  );
  const collection = collections.find((entry) => entry.id === resolvedRequest.collection_id);
  const collectionName = collection?.name ?? `Collection ${resolvedRequest.collection_id}`;

  return (
    <RequestActionsMenu
      req={resolvedRequest}
      selected={false}
      selectionCount={0}
      inspectPoint={anchor}
      canMoveUp={itemIndex > 0}
      canMoveDown={itemIndex >= 0 && itemIndex < containerItems.length - 1}
      onMoveUp={() => {
        void moveContainerItem(
          resolvedRequest.collection_id,
          containerFolderId,
          { kind: 'request', id: resolvedRequest.id },
          'up',
          containerItems,
          onReorderContainerItems
        );
      }}
      onMoveDown={() => {
        void moveContainerItem(
          resolvedRequest.collection_id,
          containerFolderId,
          { kind: 'request', id: resolvedRequest.id },
          'down',
          containerItems,
          onReorderContainerItems
        );
      }}
      onRunRequest={() => onRunRequest(resolvedRequest, collectionName)}
      onDeleteRequest={onDeleteRequest}
      onDuplicateRequest={onDuplicateRequest}
      onExportRequest={onExportRequest}
      aiChatAvailable={aiAvailable}
      onCopyToChat={(req) => {
        void copyToChat(`@request.${req.uuid}`);
      }}
      onRunSelected={() => onRunSelectedRequests([])}
      onOpenSelected={() => onOpenSelectedRequests([])}
      onNewWorkspaceFromSelected={() => onCreateWorkspaceFromSelection([])}
      onDeleteSelected={() => {
        void onDeleteSelectedRequests([]);
      }}
      presentation="anchor"
      anchorPosition={anchor}
      onDismiss={handleDismiss}
    />
  );
}

/**
 * Builds container item refs from cached requests and documents for one folder.
 *
 * @param collectionId - Parent collection id.
 * @param folderId - Folder id, or null for collection root.
 * @param requestsByCollection - Cached requests.
 * @param documentsByCollection - Cached documents.
 * @returns Ordered container item refs.
 */
function getContainerItemRefs(
  collectionId: number,
  folderId: number | null,
  requestsByCollection: Record<number, SavedRequest[]>,
  documentsByCollection: Record<number, CollectionDocument[]>
): ContainerItemRef[] {
  const requests = requestsByCollection[collectionId] ?? [];
  const documents = documentsByCollection[collectionId] ?? [];
  return toContainerItemRefs(mergeContainerItems(requests, documents, folderId));
}

/**
 * Moves a collection one position in the top-level list.
 *
 * @param collections - Active collections in current order.
 * @param collectionId - Collection to move.
 * @param direction - Up or down.
 * @param onReorderCollections - Host reorder callback.
 */
async function moveCollectionOrder(
  collections: Collection[],
  collectionId: number,
  direction: 'up' | 'down',
  onReorderCollections: (orderedIds: number[]) => Promise<void>
): Promise<void> {
  const ids = collections.map((entry) => entry.id);
  const index = ids.findIndex((id) => id === collectionId);
  if (index < 0) return;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ids.length) return;
  await onReorderCollections(arrayMove(ids, index, targetIndex));
}

/**
 * Moves a folder one position among siblings.
 *
 * @param folders - All folders in the collection.
 * @param folder - Folder to move.
 * @param direction - Up or down.
 * @param onReorder - Callback with new sibling id order.
 */
async function moveFolderOrder(
  folders: Folder[],
  folder: Folder,
  direction: 'up' | 'down',
  onReorder: (orderedIds: number[]) => Promise<void>
): Promise<void> {
  const parentFolderId = folder.parent_folder_id ?? null;
  const siblings = folders.filter((entry) => (entry.parent_folder_id ?? null) === parentFolderId);
  const ids = siblings.map((entry) => entry.id);
  const index = ids.findIndex((id) => id === folder.id);
  if (index < 0) return;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ids.length) return;
  await onReorder(arrayMove(ids, index, targetIndex));
}

/**
 * Moves a request one position within its mixed container list.
 *
 * @param collectionId - Parent collection id.
 * @param folderId - Folder id, or null for collection root.
 * @param item - Item to move.
 * @param direction - Up or down.
 * @param items - Current container order.
 * @param onReorderContainerItems - Host mixed-reorder callback.
 */
async function moveContainerItem(
  collectionId: number,
  folderId: number | null,
  item: ContainerItemRef,
  direction: 'up' | 'down',
  items: ContainerItemRef[],
  onReorderContainerItems: (
    collectionId: number,
    folderId: number | null,
    items: ContainerItemRef[]
  ) => Promise<void>
): Promise<void> {
  const index = items.findIndex((entry) => entry.kind === item.kind && entry.id === item.id);
  if (index < 0) return;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return;
  await onReorderContainerItems(collectionId, folderId, arrayMove(items, index, targetIndex));
}
