import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { SavedRequest } from '#/shared/types';
import { ResizeHandle, useResizable } from '#/renderer/src/components/Resizable';
import { useDatabaseConnections } from '#/renderer/src/hooks/useDatabaseConnections';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectCollections,
  selectDraft,
  selectEnvironments,
  selectFoldersByCollection,
  selectRequestsByCollection,
  selectSelectedCollectionId
} from '#/renderer/src/store/selectors';
import { setSelectedCollectionId } from '#/renderer/src/store/slices/collectionsSlice';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import {
  createEnvironment,
  createFolder,
  deleteCollection,
  deleteEnvironment,
  deleteFolder,
  deleteRequest,
  duplicateCollection,
  duplicateRequest,
  exportCollection,
  exportRequest,
  importRequest,
  moveRequestToFolder,
  newRequestInCollection,
  newRequestInFolder,
  refreshCollectionContents,
  renameFolder,
  reorderCollections,
  reorderFolders,
  reorderRequests
} from '#/renderer/src/store/thunks';
import { field, primaryButton, secondaryButton } from '#/renderer/src/ui/shared/classes';
import { Modal } from '#/renderer/src/ui/shared/Modal';
import { formatErrorMessage, showAlert, showConfirm } from '#/renderer/src/ui/modals/dialogHelpers';
import { Collections } from './Collections';
import { Environments } from './Environments';
import { Section } from './Section';
import { usePersistedSidebarExpansion } from './usePersistedSidebarExpansion';

interface Props {
  /**
   * Opens the new-collection modal.
   */
  onAddCollection: () => void;

  /**
   * Opens the collection settings view.
   */
  onConfigureCollection: (id: number) => void;

  /**
   * Opens the environment settings view.
   */
  onConfigureEnvironment: (id: number) => void;

  /**
   * Opens the invite modal for a collection.
   */
  onInviteCollection: (collectionId: number, collectionName: string) => void;

  /**
   * Loads a saved request into the editor.
   */
  onLoadRequest: (req: SavedRequest) => void;
}

/**
 * Left sidebar with collapsible collections and environments sections.
 */
export function Sidebar({
  onAddCollection,
  onConfigureCollection,
  onConfigureEnvironment,
  onInviteCollection,
  onLoadRequest
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const collections = useAppSelector(selectCollections);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const draft = useAppSelector(selectDraft);
  const environments = useAppSelector(selectEnvironments);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);

  /**
   * Loads folders and requests when a collection tree is expanded.
   */
  const handleExpandCollection = useCallback(
    (id: number) => {
      void dispatch(refreshCollectionContents(id));
    },
    [dispatch]
  );

  const {
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    toggleCollectionsSection,
    toggleEnvironmentsSection,
    expandedCollectionIds,
    expandedFolderIds,
    setExpandedCollectionIds,
    setExpandedFolderIds
  } = usePersistedSidebarExpansion({
    onExpandCollection: handleExpandCollection
  });

  const [showEnvironmentModal, setShowEnvironmentModal] = useState(false);
  const [newEnvironmentName, setNewEnvironmentName] = useState('');
  const [environmentModalError, setEnvironmentModalError] = useState<string | null>(null);
  const [folderModal, setFolderModal] = useState<{
    mode: 'create' | 'rename';
    collectionId: number;
    folderId?: number;
    name: string;
    error: string | null;
  } | null>(null);
  const {
    connections: databaseConnections,
    primaryConnectionId,
    error: connectionsError
  } = useDatabaseConnections();
  const { size: width, onResizeStart } = useResizable({
    axis: 'x',
    direction: 1,
    defaultSize: 400,
    minSize: 240,
    getMaxSize: () => 640,
    storageKey: 'hc.sidebarWidth'
  });

  /**
   * Surfaces a one-time toast when database connection bootstrap fails so badges
   * may be missing without silent failure.
   */
  useEffect(() => {
    if (connectionsError) {
      toast.error(`Failed to load databases: ${connectionsError}`);
    }
  }, [connectionsError]);

  /**
   * Maps connection ids to display names for sidebar badges.
   */
  const connectionNamesById = useMemo(
    () =>
      Object.fromEntries(
        databaseConnections.map((connection) => [connection.id, connection.name || 'Untitled'])
      ),
    [databaseConnections]
  );

  /**
   * Maps connection ids to provider types for sidebar badges.
   */
  const connectionTypesById = useMemo(
    () =>
      Object.fromEntries(databaseConnections.map((connection) => [connection.id, connection.type])),
    [databaseConnections]
  );

  /**
   * Closes the new-environment modal and clears its form state.
   */
  const closeEnvironmentModal = (): void => {
    setShowEnvironmentModal(false);
    setNewEnvironmentName('');
    setEnvironmentModalError(null);
  };

  /**
   * Closes the folder create/rename modal.
   */
  const closeFolderModal = (): void => {
    setFolderModal(null);
  };

  /**
   * Creates or renames a folder from the modal form.
   */
  const handleFolderModalSubmit = async (): Promise<void> => {
    if (!folderModal) return;
    const name = folderModal.name.trim();
    if (!name) return;

    const { mode, collectionId, folderId } = folderModal;
    setFolderModal({ ...folderModal, error: null });
    try {
      if (mode === 'create') {
        await dispatch(createFolder({ collectionId, name })).unwrap();
        toast.success('Folder created');
      } else if (folderId != null) {
        await dispatch(renameFolder({ id: folderId, collectionId, name })).unwrap();
        toast.success('Folder renamed');
      }
      closeFolderModal();
    } catch (err) {
      setFolderModal({
        ...folderModal,
        error: formatErrorMessage(err, 'Failed to save folder')
      });
    }
  };

  /**
   * Creates an environment from the modal form.
   */
  const handleEnvironmentModalSubmit = async (): Promise<void> => {
    const name = newEnvironmentName.trim();
    if (!name) return;
    setEnvironmentModalError(null);
    try {
      await dispatch(createEnvironment(name)).unwrap();
      toast.success('Environment created');
      closeEnvironmentModal();
    } catch (err) {
      setEnvironmentModalError(formatErrorMessage(err, 'Failed to create environment'));
    }
  };

  return (
    <>
      <aside className="flex shrink-0 flex-col bg-sidebar" style={{ width }}>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          <Section
            title="Collections"
            expanded={collectionsSectionExpanded}
            onToggle={toggleCollectionsSection}
            onAdd={onAddCollection}
            addLabel="Add Collection"
          >
            <Collections
              collections={collections}
              foldersByCollection={foldersByCollection}
              requestsByCollection={requestsByCollection}
              selectedCollectionId={selectedCollectionId}
              primaryConnectionId={primaryConnectionId}
              connectionNamesById={connectionNamesById}
              connectionTypesById={connectionTypesById}
              activeRequestId={draft.id}
              expandedCollectionIds={expandedCollectionIds}
              expandedFolderIds={expandedFolderIds}
              setExpandedCollectionIds={setExpandedCollectionIds}
              setExpandedFolderIds={setExpandedFolderIds}
              onSelectCollection={(id) => dispatch(setSelectedCollectionId(id))}
              onExpandCollection={handleExpandCollection}
              onConfigureCollection={onConfigureCollection}
              onDeleteCollection={async (id) => {
                await dispatch(deleteCollection(id));
              }}
              onExportCollection={async (id) => {
                const result = await dispatch(exportCollection(id)).unwrap();
                if (!result.canceled) {
                  toast.success('Collection exported');
                }
              }}
              onDuplicateCollection={async (id) => {
                try {
                  await dispatch(duplicateCollection(id)).unwrap();
                  toast.success('Collection duplicated');
                } catch (err) {
                  showAlert(dispatch, formatErrorMessage(err, 'Failed to duplicate collection'));
                }
              }}
              onInviteCollection={onInviteCollection}
              onNewFolder={(collectionId) => {
                setFolderModal({ mode: 'create', collectionId, name: '', error: null });
              }}
              onNewRequestInCollection={async (id) => {
                try {
                  await dispatch(newRequestInCollection(id)).unwrap();
                } catch (err) {
                  showAlert(dispatch, formatErrorMessage(err, 'Failed to create request'));
                }
              }}
              onImportRequest={async (collectionId, folderId) => {
                try {
                  const saved = await dispatch(importRequest({ collectionId, folderId })).unwrap();
                  if (saved) {
                    toast.success('Request imported');
                  }
                } catch (err) {
                  showAlert(dispatch, formatErrorMessage(err, 'Failed to import request'));
                }
              }}
              onNewRequestInFolder={async (collectionId, folderId) => {
                try {
                  await dispatch(newRequestInFolder({ collectionId, folderId })).unwrap();
                } catch (err) {
                  showAlert(dispatch, formatErrorMessage(err, 'Failed to create request'));
                }
              }}
              onRenameFolder={(id, collectionId) => {
                const folders = foldersByCollection[collectionId] ?? [];
                const folder = folders.find((item) => item.id === id);
                setFolderModal({
                  mode: 'rename',
                  collectionId,
                  folderId: id,
                  name: folder?.name ?? '',
                  error: null
                });
              }}
              onDeleteFolder={async (id, collectionId, requestIds) => {
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
              }}
              onReorderCollections={async (orderedCollectionIds) => {
                await dispatch(reorderCollections({ orderedCollectionIds }));
              }}
              onReorderFolders={async (collectionId, orderedFolderIds) => {
                await dispatch(reorderFolders({ collectionId, orderedFolderIds }));
              }}
              onReorderRequests={async (collectionId, folderId, orderedRequestIds) => {
                await dispatch(reorderRequests({ collectionId, folderId, orderedRequestIds }));
              }}
              onMoveRequest={async (collectionId, requestId, folderId, index) => {
                await dispatch(moveRequestToFolder({ collectionId, requestId, folderId, index }));
              }}
              onLoadRequest={onLoadRequest}
              onDeleteRequest={async (id) => {
                await dispatch(deleteRequest(id));
              }}
              onDuplicateRequest={async (req) => {
                try {
                  await dispatch(duplicateRequest(req)).unwrap();
                } catch (err) {
                  showAlert(dispatch, formatErrorMessage(err, 'Failed to duplicate request'));
                }
              }}
              onExportRequest={async (req) => {
                const result = await dispatch(exportRequest(req)).unwrap();
                if (!result.canceled) {
                  toast.success('Request exported');
                }
              }}
            />
          </Section>

          <Section
            title="Environments"
            expanded={environmentsSectionExpanded}
            onToggle={toggleEnvironmentsSection}
            onAdd={() => {
              setNewEnvironmentName('');
              setEnvironmentModalError(null);
              setShowEnvironmentModal(true);
            }}
            addLabel="Add Environment"
          >
            <Environments
              environments={environments}
              activeEnvironmentId={activeEnvironmentId}
              onSelectEnvironment={(id) => dispatch(setActiveEnvironmentId(id))}
              onConfigureEnvironment={onConfigureEnvironment}
              onDeleteEnvironment={async (id) => {
                await dispatch(deleteEnvironment(id));
              }}
            />
          </Section>
        </div>
      </aside>
      <ResizeHandle
        orientation="vertical"
        onResizeStart={onResizeStart}
        ariaLabel="Resize sidebar"
      />

      {folderModal && (
        <Modal onClose={closeFolderModal}>
          <h2 className="m-0 mb-1 text-[13px] font-semibold text-text">
            {folderModal.mode === 'create' ? 'New folder' : 'Rename folder'}
          </h2>
          <input
            className={`${field} mt-3 w-full`}
            type="text"
            autoFocus
            placeholder="Folder name"
            value={folderModal.name}
            onChange={(e) =>
              setFolderModal((current) =>
                current ? { ...current, name: e.target.value, error: null } : current
              )
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleFolderModalSubmit();
            }}
          />
          {folderModal.error && <p className="mt-3 text-[12px] text-danger">{folderModal.error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button className={secondaryButton} onClick={closeFolderModal}>
              Cancel
            </button>
            <button
              className={primaryButton}
              onClick={() => void handleFolderModalSubmit()}
              disabled={!folderModal.name.trim()}
            >
              {folderModal.mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      {showEnvironmentModal && (
        <Modal onClose={closeEnvironmentModal}>
          <h2 className="m-0 mb-1 text-[13px] font-semibold text-text">New environment</h2>
          <input
            className={`${field} mt-3 w-full`}
            type="text"
            autoFocus
            placeholder="Environment name"
            value={newEnvironmentName}
            onChange={(e) => {
              setNewEnvironmentName(e.target.value);
              setEnvironmentModalError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleEnvironmentModalSubmit();
            }}
          />
          {environmentModalError && (
            <p className="mt-3 text-[12px] text-danger">{environmentModalError}</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button className={secondaryButton} onClick={closeEnvironmentModal}>
              Cancel
            </button>
            <button
              className={primaryButton}
              onClick={() => void handleEnvironmentModalSubmit()}
              disabled={!newEnvironmentName.trim()}
            >
              Create
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
