import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { SavedRequest } from '#/shared/types';
import { ResizeHandle, useResizable } from '#/renderer/src/components/Resizable';
import {
  isTeamHubProvider,
  providerTypesById,
  useProviders
} from '#/renderer/src/hooks/useProviders';
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
  exportEnvironment,
  exportRequest,
  importEnvironment,
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
import { Button } from '#/renderer/src/components/Button';
import {
  SegmentedTabs,
  SegmentedTabPanel,
  SegmentedTabsGroup
} from '#/renderer/src/components/SegmentedTabs';
import { field } from '#/renderer/src/ui/shared/classes';
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
  const [environmentModalTab, setEnvironmentModalTab] = useState<'create' | 'import'>('create');
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
    providers,
    primaryProviderId: primaryConnectionId,
    error: providersError
  } = useProviders();
  const {
    size: width,
    minSize: sidebarMinSize,
    maxSize: sidebarMaxSize,
    onResizeStart,
    onKeyboardResize
  } = useResizable({
    axis: 'x',
    direction: 1,
    defaultSize: 400,
    minSize: 240,
    getMaxSize: () => 640,
    storageKey: 'hc.sidebarWidth'
  });

  /**
   * Surfaces a one-time toast when provider bootstrap fails so badges
   * may be missing without silent failure.
   */
  useEffect(() => {
    if (providersError) {
      toast.error(`Failed to load providers: ${providersError}`);
    }
  }, [providersError]);

  /**
   * Maps connection ids to display names for sidebar badges.
   */
  const connectionNamesById = useMemo(
    () =>
      Object.fromEntries(providers.map((provider) => [provider.id, provider.name || 'Untitled'])),
    [providers]
  );

  /**
   * Maps connection ids to provider types for sidebar badges.
   */
  const connectionTypesById = useMemo(() => providerTypesById(providers), [providers]);

  /**
   * Closes the new-environment modal and clears its form state.
   */
  const closeEnvironmentModal = (): void => {
    setShowEnvironmentModal(false);
    setEnvironmentModalTab('create');
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

  /**
   * Imports an environment from a JSON file selected via a native dialog.
   */
  const handleEnvironmentImport = async (): Promise<void> => {
    setEnvironmentModalError(null);
    try {
      const environment = await dispatch(importEnvironment()).unwrap();
      if (!environment) return;
      toast.success('Environment imported');
      closeEnvironmentModal();
    } catch (err) {
      setEnvironmentModalError(formatErrorMessage(err, 'Failed to import environment'));
    }
  };

  return (
    <>
      <aside className="flex shrink-0 flex-col bg-sidebar" style={{ width }}>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          <nav aria-label="Collections">
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
                  const collection = collections.find((item) => item.id === id);
                  if (collection && isTeamHubProvider(providers, collection.connectionId)) {
                    const confirmed = await showConfirm(dispatch, {
                      title: 'Delete collection',
                      message:
                        'Delete this collection from the team hub? Team members will lose access to it on the server.',
                      confirmLabel: 'Delete',
                      variant: 'danger'
                    });
                    if (!confirmed) return;
                  }
                  try {
                    await dispatch(deleteCollection(id)).unwrap();
                  } catch (err) {
                    showAlert(dispatch, formatErrorMessage(err, 'Failed to delete collection'));
                  }
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
                    const saved = await dispatch(
                      importRequest({ collectionId, folderId })
                    ).unwrap();
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
          </nav>

          <nav aria-label="Environments">
            <Section
              title="Environments"
              expanded={environmentsSectionExpanded}
              onToggle={toggleEnvironmentsSection}
              onAdd={() => {
                setEnvironmentModalTab('create');
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
                onExportEnvironment={async (id) => {
                  const result = await dispatch(exportEnvironment(id)).unwrap();
                  if (!result.canceled) {
                    toast.success('Environment exported');
                  }
                }}
              />
            </Section>
          </nav>
        </div>
      </aside>
      <ResizeHandle
        orientation="vertical"
        value={width}
        min={sidebarMinSize}
        max={sidebarMaxSize}
        onResizeStart={onResizeStart}
        onKeyboardResize={onKeyboardResize}
        ariaLabel="Resize sidebar"
      />

      {folderModal && (
        <Modal onClose={closeFolderModal} labelledBy="sidebar-folder-modal-title">
          <h2
            id="sidebar-folder-modal-title"
            className="m-0 mb-1 text-[14px] font-semibold text-text"
          >
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
          {folderModal.error && <p className="mt-3 text-[14px] text-danger">{folderModal.error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={closeFolderModal}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleFolderModalSubmit()}
              disabled={!folderModal.name.trim()}
            >
              {folderModal.mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </div>
        </Modal>
      )}

      {showEnvironmentModal && (
        <Modal onClose={closeEnvironmentModal} labelledBy="sidebar-environment-modal-title">
          <h2
            id="sidebar-environment-modal-title"
            className="m-0 mb-1 text-[14px] font-semibold text-text"
          >
            Add environment
          </h2>

          <SegmentedTabsGroup
            value={environmentModalTab}
            onChange={setEnvironmentModalTab}
            ariaLabel="Add environment options"
          >
            <SegmentedTabs
              fullWidth
              className="mb-3 mt-3"
              tabs={[
                { value: 'create', label: 'Create new' },
                { value: 'import', label: 'Import from file' }
              ]}
            />

            {environmentModalError && (
              <p className="mb-3 text-[14px] text-danger">{environmentModalError}</p>
            )}

            <SegmentedTabPanel value="create">
              <input
                className={`${field} w-full`}
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
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="secondary" onClick={closeEnvironmentModal}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleEnvironmentModalSubmit()}
                  disabled={!newEnvironmentName.trim()}
                >
                  Create
                </Button>
              </div>
            </SegmentedTabPanel>

            <SegmentedTabPanel value="import">
              <p className="mb-4 text-[14px] text-muted">
                Choose a HarborClient environment export (.json) to import variables and settings.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={closeEnvironmentModal}>
                  Cancel
                </Button>
                <Button onClick={() => void handleEnvironmentImport()}>Import .json</Button>
              </div>
            </SegmentedTabPanel>
          </SegmentedTabsGroup>
        </Modal>
      )}
    </>
  );
}
