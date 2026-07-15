import { useCallback } from 'react';
import toast from 'react-hot-toast';
import type { ContainerItemRef } from '#/shared/collectionContainerOrder';
import type { CollectionDocument, SavedRequest } from '#/shared/types';
import { isTeamHubProvider } from '#/renderer/src/hooks/useProviders';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectCollections } from '#/renderer/src/store/selectors';
import { setSelectedCollectionId } from '#/renderer/src/store/slices/collectionsSlice';
import {
  openCollectionRunner,
  openShareModal,
  openTabGroupModal
} from '#/renderer/src/store/slices/modalsSlice';
import { loadRequest, openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  deleteCollection,
  deleteDocument,
  deleteFolder,
  deleteRequest,
  duplicateCollection,
  duplicateRequest,
  exportCollection,
  exportRequest,
  focusSidebarItem,
  importRequest,
  loadTrustedKeys,
  moveRequestToFolder,
  moveDocumentToFolder,
  newRequestInCollection,
  newRequestInFolder,
  refreshCollectionContents,
  refreshRequests,
  reorderCollections,
  reorderDocuments,
  reorderContainerItems,
  reorderFolders,
  reorderRequests,
  requestLoadDocument,
  requestLoadRequest,
  saveAllDirtyRequests
} from '#/renderer/src/store/thunks';
import { formatErrorMessage, showAlert, showConfirm } from '#/renderer/src/ui/Modals/dialogHelpers';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/useSidebarExpansion';
import { useSidebarModals } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sidebarModalsContext';
import { useSidebarProviders } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sidebarProvidersContext';

/**
 * Builds the sidebar focus payload when opening a saved request so git-backed
 * collections and folder highlights follow the opened item.
 *
 * @param req - Saved request whose parent collection and folder should be selected.
 * @returns Payload for {@link focusSidebarItem}.
 */
export function sidebarFocusPayloadForRequest(
  req: Pick<SavedRequest, 'collection_id' | 'folder_id'>
): { collectionId: number; folderId: number | null } {
  return { collectionId: req.collection_id, folderId: req.folder_id ?? null };
}

/**
 * Builds the sidebar focus payload when opening a markdown document so git-backed
 * collections and folder highlights follow the opened item.
 *
 * @param doc - Document whose parent collection and folder should be selected.
 * @returns Payload for {@link focusSidebarItem}.
 */
export function sidebarFocusPayloadForDocument(
  doc: Pick<CollectionDocument, 'collection_id' | 'folder_id'>
): { collectionId: number; folderId: number | null } {
  return { collectionId: doc.collection_id, folderId: doc.folder_id ?? null };
}

/**
 * Callback bundle for the collections tree. Every action dispatches the
 * relevant thunk (with confirmation/toast handling) so the `Collections`
 * component owns its behavior instead of receiving dozens of props.
 */
export interface CollectionActions {
  /**
   * Loads folders and requests when a collection is expanded.
   */
  onExpandCollection: (id: number) => void;

  /**
   * Selects a collection row and reveals it in the tree.
   */
  onSelectCollection: (id: number) => void;

  /**
   * Clears the sidebar collection and folder highlight.
   */
  onClearCollectionSelection: () => void;

  /**
   * Selects a folder row and reveals it in the tree.
   */
  onSelectFolder: (collectionId: number, folderId: number) => void;

  /**
   * Opens collection settings.
   */
  onConfigureCollection: (id: number) => void;

  /**
   * Opens folder settings.
   */
  onConfigureFolder: (collectionId: number, folderId: number) => void;

  /**
   * Opens the collection runner for an entire collection.
   */
  onRunCollection: (collectionId: number, collectionName: string) => void;

  /**
   * Opens the collection runner scoped to one folder.
   */
  onRunFolder: (
    collectionId: number,
    folderId: number,
    collectionName: string,
    folderName: string
  ) => void;

  /**
   * Opens the collection runner scoped to one saved request.
   */
  onRunRequest: (req: SavedRequest, collectionName: string) => void;

  /**
   * Deletes a collection, confirming first for team-hub-backed collections.
   */
  onDeleteCollection: (id: number, options?: { deleteRepoDirectory?: boolean }) => Promise<void>;

  /**
   * Exports a collection to disk.
   */
  onExportCollection: (id: number) => Promise<void>;

  /**
   * Duplicates a collection and its contents.
   */
  onDuplicateCollection: (id: number) => Promise<void>;

  /**
   * Opens the share flow for a shared collection.
   */
  onShareCollection: (collectionId: number, collectionName: string) => void;

  /**
   * Saves every dirty open request in the collection.
   */
  onSaveAllInCollection: (collectionId: number) => Promise<void>;

  /**
   * Saves every dirty open request in the folder.
   */
  onSaveAllInFolder: (collectionId: number, folderId: number) => Promise<void>;

  /**
   * Opens the create-folder modal.
   */
  onNewFolder: (collectionId: number) => void;

  /**
   * Creates a new request at the collection root.
   */
  onNewRequestInCollection: (id: number) => Promise<void>;

  /**
   * Imports a request from a JSON file into a collection or folder.
   */
  onImportRequest: (collectionId: number, folderId?: number | null) => Promise<void>;

  /**
   * Creates a new request inside a folder.
   */
  onNewRequestInFolder: (collectionId: number, folderId: number) => Promise<void>;

  /**
   * Opens the create-document modal at the collection root.
   */
  onNewDocumentInCollection: (collectionId: number) => void;

  /**
   * Opens the create-document modal inside a folder.
   */
  onNewDocumentInFolder: (collectionId: number, folderId: number) => void;

  /**
   * Opens the rename-folder modal.
   */
  onRenameFolder: (id: number, collectionId: number) => void;

  /**
   * Deletes a folder and any requests it contains, confirming first.
   */
  onDeleteFolder: (id: number, collectionId: number, requestIds: number[]) => Promise<void>;

  /**
   * Persists a new top-level collection order.
   */
  onReorderCollections: (orderedCollectionIds: number[]) => Promise<void>;

  /**
   * Persists a new folder order within a collection.
   */
  onReorderFolders: (collectionId: number, orderedFolderIds: number[]) => Promise<void>;

  /**
   * Persists a new request order within a folder or collection root.
   */
  onReorderRequests: (
    collectionId: number,
    folderId: number | null,
    orderedRequestIds: number[]
  ) => Promise<void>;

  /**
   * Moves a request to another folder or collection root at the given index.
   */
  onMoveRequest: (
    collectionId: number,
    requestId: number,
    folderId: number | null,
    index: number
  ) => Promise<void>;

  /**
   * Loads a saved request into the editor.
   */
  onLoadRequest: (req: SavedRequest) => void;

  /**
   * Loads a markdown document into the editor.
   */
  onLoadDocument: (doc: CollectionDocument) => void;

  /**
   * Opens the rename modal for a markdown document.
   */
  onRenameDocument: (doc: CollectionDocument) => void;

  /**
   * Deletes a markdown document.
   */
  onDeleteDocument: (id: number, collectionId: number) => Promise<void>;

  /**
   * Persists a new document order within a folder or collection root.
   */
  onReorderDocuments: (
    collectionId: number,
    folderId: number | null,
    orderedDocumentIds: number[]
  ) => Promise<void>;

  /**
   * Persists unified sidebar order for requests and markdown documents in one container.
   */
  onReorderContainerItems: (
    collectionId: number,
    folderId: number | null,
    items: ContainerItemRef[]
  ) => Promise<void>;

  /**
   * Moves a markdown document to another folder or collection root at the given index.
   */
  onMoveDocument: (
    collectionId: number,
    documentId: number,
    folderId: number | null,
    index: number
  ) => Promise<void>;

  /**
   * Deletes a saved request.
   */
  onDeleteRequest: (id: number) => Promise<void>;

  /**
   * Duplicates a saved request.
   */
  onDuplicateRequest: (req: SavedRequest) => Promise<void>;

  /**
   * Exports a saved request to a JSON file.
   */
  onExportRequest: (req: SavedRequest) => Promise<void>;

  /**
   * Opens every saved request in the selection as editor tabs.
   */
  onOpenSelectedRequests: (requests: SavedRequest[]) => void;

  /**
   * Opens the tab group modal to create a group from a sidebar selection.
   */
  onCreateTabGroupFromSelection: (requestIds: number[]) => void;

  /**
   * Deletes every saved request in the selection after one confirmation.
   */
  onDeleteSelectedRequests: (requests: SavedRequest[]) => Promise<boolean>;

  /**
   * Opens the collection runner for an explicit saved request selection.
   */
  onRunSelectedRequests: (requests: SavedRequest[]) => void;
}

/**
 * Builds the collection tree action bundle from the store, sidebar providers,
 * expansion reveal helpers, and modal openers.
 */
export function useCollectionActions(): CollectionActions {
  const dispatch = useAppDispatch();
  const collections = useAppSelector(selectCollections);
  const { providers } = useSidebarProviders();
  const { revealCollection, revealFolder } = useSidebarExpansion();
  const { openNewFolder, openRenameFolder, openNewDocument, openRenameDocument } =
    useSidebarModals();

  /**
   * Loads folders and requests when a collection is expanded. Kept referentially
   * stable because it feeds a `useEffect` dependency in `Collections`.
   */
  const onExpandCollection = useCallback(
    (id: number) => {
      void dispatch(refreshCollectionContents(id));
    },
    [dispatch]
  );

  return {
    onExpandCollection,
    onSelectCollection: (id) => {
      dispatch(setSelectedCollectionId(id));
      revealCollection(id);
    },
    onClearCollectionSelection: () => {
      dispatch(setSelectedCollectionId(null));
    },
    onSelectFolder: (collectionId, folderId) => {
      dispatch(focusSidebarItem({ collectionId, folderId }));
      revealFolder(collectionId, folderId);
    },
    onConfigureCollection: (id) => {
      dispatch(openPageTab({ type: 'collection', id }));
    },
    onConfigureFolder: (collectionId, folderId) => {
      dispatch(openPageTab({ type: 'folder', collectionId, id: folderId }));
    },
    onRunCollection: (collectionId, collectionName) => {
      dispatch(openCollectionRunner({ collectionId, collectionName }));
      dispatch(openPageTab({ type: 'collection-runner', collectionId }));
    },
    onRunFolder: (collectionId, folderId, collectionName, folderName) => {
      dispatch(openCollectionRunner({ collectionId, folderId, collectionName, folderName }));
      dispatch(openPageTab({ type: 'collection-runner', collectionId, folderId }));
    },
    onRunRequest: (req, collectionName) => {
      dispatch(
        openCollectionRunner({
          collectionId: req.collection_id,
          folderId: req.folder_id ?? null,
          collectionName,
          requestId: req.id,
          requestName: req.name
        })
      );
      dispatch(
        openPageTab({
          type: 'collection-runner',
          collectionId: req.collection_id,
          folderId: req.folder_id ?? null,
          requestId: req.id
        })
      );
    },
    onDeleteCollection: async (id, options) => {
      const collection = collections.find((item) => item.id === id);
      if (collection && isTeamHubProvider(providers, collection.connectionId)) {
        const confirmed = await showConfirm(dispatch, {
          title: collection.deletion_locked ? 'Remove collection' : 'Delete collection',
          message: collection.deletion_locked
            ? 'Remove this collection from your sidebar only? It will stay on the team hub for other members.'
            : 'Delete this collection from the team hub? Team members will lose access to it on the server.',
          confirmLabel: collection.deletion_locked ? 'Remove' : 'Delete',
          variant: 'danger'
        });
        if (!confirmed) return;
      }
      try {
        await dispatch(deleteCollection(id)).unwrap();
        if (collection?.deletion_locked) {
          toast.success('Collection removed from sidebar.');
        }
        if (options?.deleteRepoDirectory && collection?.connectionId) {
          try {
            await window.api.gitDeleteRepoDirectory(collection.connectionId);
          } catch (err) {
            showAlert(dispatch, formatErrorMessage(err, 'Failed to delete repo directory'));
          }
        }
      } catch (err) {
        showAlert(dispatch, formatErrorMessage(err, 'Failed to delete collection'));
      }
    },
    onExportCollection: async (id) => {
      const result = await dispatch(exportCollection(id)).unwrap();
      if (!result.canceled) {
        toast.success('Collection exported');
      }
    },
    onDuplicateCollection: async (id) => {
      try {
        await dispatch(duplicateCollection(id)).unwrap();
        toast.success('Collection duplicated');
      } catch (err) {
        showAlert(dispatch, formatErrorMessage(err, 'Failed to duplicate collection'));
      }
    },
    onShareCollection: (collectionId, collectionName) => {
      dispatch(openShareModal({ collectionId, collectionName }));
      void dispatch(loadTrustedKeys());
    },
    onSaveAllInCollection: async (collectionId) => {
      try {
        const result = await dispatch(saveAllDirtyRequests({ collectionId })).unwrap();
        if (result.savedCount === 0) {
          toast('No unsaved requests in this collection');
        } else {
          toast.success(`Saved ${result.savedCount} request${result.savedCount === 1 ? '' : 's'}`);
        }
      } catch (err) {
        showAlert(dispatch, formatErrorMessage(err, 'Failed to save requests'));
      }
    },
    onSaveAllInFolder: async (collectionId, folderId) => {
      try {
        const result = await dispatch(saveAllDirtyRequests({ collectionId, folderId })).unwrap();
        if (result.savedCount === 0) {
          toast('No unsaved requests in this folder');
        } else {
          toast.success(`Saved ${result.savedCount} request${result.savedCount === 1 ? '' : 's'}`);
        }
      } catch (err) {
        showAlert(dispatch, formatErrorMessage(err, 'Failed to save requests'));
      }
    },
    onNewFolder: (collectionId) => {
      openNewFolder(collectionId);
    },
    onNewRequestInCollection: async (id) => {
      try {
        await dispatch(newRequestInCollection(id)).unwrap();
      } catch (err) {
        showAlert(dispatch, formatErrorMessage(err, 'Failed to create request'));
      }
    },
    onImportRequest: async (collectionId, folderId) => {
      try {
        const saved = await dispatch(importRequest({ collectionId, folderId })).unwrap();
        if (saved) {
          toast.success('Request imported');
        }
      } catch (err) {
        showAlert(dispatch, formatErrorMessage(err, 'Failed to import request'));
      }
    },
    onNewRequestInFolder: async (collectionId, folderId) => {
      try {
        await dispatch(newRequestInFolder({ collectionId, folderId })).unwrap();
      } catch (err) {
        showAlert(dispatch, formatErrorMessage(err, 'Failed to create request'));
      }
    },
    onNewDocumentInCollection: (collectionId) => {
      openNewDocument(collectionId);
    },
    onNewDocumentInFolder: (collectionId, folderId) => {
      openNewDocument(collectionId, folderId);
    },
    onRenameFolder: (id, collectionId) => {
      openRenameFolder(id, collectionId);
    },
    onDeleteFolder: async (id, collectionId, requestIds) => {
      const count = requestIds.length;
      const message =
        count > 0
          ? `Delete this folder and ${count} request${count === 1 ? '' : 's'} inside it?`
          : 'Delete this folder?';
      const confirmed = await showConfirm(dispatch, {
        title: 'Delete folder',
        message,
        confirmLabel: 'Delete',
        variant: 'danger'
      });
      if (!confirmed) return;
      try {
        await dispatch(deleteFolder({ id, collectionId, requestIds })).unwrap();
      } catch (err) {
        showAlert(dispatch, formatErrorMessage(err, 'Failed to delete folder'));
      }
    },
    onReorderCollections: async (orderedCollectionIds) => {
      await dispatch(reorderCollections({ orderedCollectionIds }));
    },
    onReorderFolders: async (collectionId, orderedFolderIds) => {
      await dispatch(reorderFolders({ collectionId, orderedFolderIds }));
    },
    onReorderRequests: async (collectionId, folderId, orderedRequestIds) => {
      await dispatch(reorderRequests({ collectionId, folderId, orderedRequestIds }));
    },
    onMoveRequest: async (collectionId, requestId, folderId, index) => {
      await dispatch(moveRequestToFolder({ collectionId, requestId, folderId, index }));
    },
    onLoadRequest: (req) => {
      dispatch(focusSidebarItem(sidebarFocusPayloadForRequest(req)));
      void dispatch(requestLoadRequest({ req }));
    },
    onLoadDocument: (doc) => {
      dispatch(focusSidebarItem(sidebarFocusPayloadForDocument(doc)));
      void dispatch(requestLoadDocument({ doc }));
    },
    onRenameDocument: (doc) => {
      openRenameDocument(doc);
    },
    onDeleteDocument: async (id, collectionId) => {
      try {
        await dispatch(deleteDocument({ id, collectionId })).unwrap();
      } catch (err) {
        showAlert(dispatch, formatErrorMessage(err, 'Failed to delete document'));
      }
    },
    onReorderDocuments: async (collectionId, folderId, orderedDocumentIds) => {
      await dispatch(reorderDocuments({ collectionId, folderId, orderedDocumentIds }));
    },
    onReorderContainerItems: async (collectionId, folderId, items) => {
      await dispatch(reorderContainerItems({ collectionId, folderId, items }));
    },
    onMoveDocument: async (collectionId, documentId, folderId, index) => {
      await dispatch(moveDocumentToFolder({ collectionId, documentId, folderId, index }));
    },
    onDeleteRequest: async (id) => {
      await dispatch(deleteRequest(id));
    },
    onDuplicateRequest: async (req) => {
      try {
        await dispatch(duplicateRequest(req)).unwrap();
      } catch (err) {
        showAlert(dispatch, formatErrorMessage(err, 'Failed to duplicate request'));
      }
    },
    onExportRequest: async (req) => {
      const result = await dispatch(exportRequest(req)).unwrap();
      if (!result.canceled) {
        toast.success('Request exported');
      }
    },
    onOpenSelectedRequests: (requests) => {
      requests.forEach((req, index) => {
        dispatch(loadRequest({ req, activate: index === 0 }));
      });
    },
    onCreateTabGroupFromSelection: (requestIds) => {
      dispatch(
        openTabGroupModal({
          mode: 'createFromSelection',
          requestIds,
          name: ''
        })
      );
    },
    onDeleteSelectedRequests: async (requests) => {
      if (requests.length === 0) {
        return false;
      }

      const confirmed = await showConfirm(dispatch, {
        title: 'Delete requests',
        message: `Delete ${requests.length} selected request${requests.length === 1 ? '' : 's'}?`,
        confirmLabel: 'Delete',
        variant: 'danger'
      });
      if (!confirmed) {
        return false;
      }

      try {
        await Promise.all(requests.map((req) => dispatch(deleteRequest(req.id))));
        const collectionIds = new Set(requests.map((req) => req.collection_id));
        for (const collectionId of collectionIds) {
          await dispatch(refreshRequests(collectionId));
        }
        return true;
      } catch (err) {
        showAlert(dispatch, formatErrorMessage(err, 'Failed to delete requests'));
        return false;
      }
    },
    onRunSelectedRequests: (requests) => {
      const requestIds = requests.map((req) => req.id);
      dispatch(
        openCollectionRunner({
          collectionId: 0,
          collectionName: 'Selected requests',
          requestIds
        })
      );
      dispatch(
        openPageTab({
          type: 'collection-runner',
          collectionId: 0,
          requestIds
        })
      );
    }
  };
}
