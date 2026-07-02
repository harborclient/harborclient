import { ControlledAccordion, useAccordionProvider } from '@szhsin/react-accordion';
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { PluginSurface } from '#/renderer/src/plugins/PluginSurface';
import {
  usePluginSidebarPanels,
  usePluginSidebarSections
} from '#/renderer/src/plugins/pluginHooks';
import toast from 'react-hot-toast';
import type { SavedRequest } from '#/shared/types';
import { ResizeHandle, useResizable } from '@harborclient/sdk/components';
import {
  isTeamHubProvider,
  providerTypesById,
  useProviders
} from '#/renderer/src/hooks/useProviders';
import { useGitStatuses } from '#/renderer/src/hooks/useGitStatuses';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectCollections,
  selectDraft,
  selectEnvironments,
  selectFoldersByCollection,
  selectRequestsByCollection,
  selectSelectedCollectionId,
  selectSelectedFolderId
} from '#/renderer/src/store/selectors';
import { setSelectedCollectionId } from '#/renderer/src/store/slices/collectionsSlice';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import {
  selectActiveSidebarPanelId,
  setActiveSidebarPanel
} from '#/renderer/src/store/slices/navigationSlice';
import {
  createEnvironment,
  createFolder,
  deleteCollection,
  deleteEnvironment,
  deleteFolder,
  deleteRequest,
  duplicateCollection,
  duplicateEnvironment,
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
  refreshCollections,
  renameFolder,
  reorderCollections,
  reorderEnvironments,
  reorderFolders,
  reorderRequests,
  focusSidebarItem
} from '#/renderer/src/store/thunks';
import { Button } from '@harborclient/sdk/components';
import { SegmentedTabs, SegmentedTabPanel, SegmentedTabsGroup } from '@harborclient/sdk/components';
import { Input } from '@harborclient/sdk/components';
import { Modal, ModalFooter } from '@harborclient/sdk/components';
import { FieldError } from '@harborclient/sdk/components';
import { formatErrorMessage, showAlert, showConfirm } from '#/renderer/src/ui/modals/dialogHelpers';
import { openCollectionRunnerModal } from '#/renderer/src/store/slices/modalsSlice';
import { Collections } from './Collections';
import { GitSourceControlPanel } from '#/renderer/src/ui/modals/GitSourceControlPanel';
import { Environments } from './Environments';
import { Section } from './Section';
import { SidebarSearch } from './SidebarSearch';
import { useSidebarExpansion } from './useSidebarExpansion';
import { useSidebarSearch } from './useSidebarSearch';

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
   * Opens the share modal for a collection.
   */
  onShareCollection: (collectionId: number, collectionName: string) => void;

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
  onShareCollection,
  onLoadRequest
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const collections = useAppSelector(selectCollections);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const selectedFolderId = useAppSelector(selectSelectedFolderId);
  const draft = useAppSelector(selectDraft);
  const environments = useAppSelector(selectEnvironments);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const activeSidebarPanelId = useAppSelector(selectActiveSidebarPanelId);
  const pluginSidebarPanels = usePluginSidebarPanels();
  const pluginSidebarSections = usePluginSidebarSections();
  const [pluginSectionExpanded, setPluginSectionExpanded] = useState<Record<string, boolean>>({});

  /**
   * Resolves the active switchable sidebar panel contribution, if any.
   */
  const activeSidebarPanel = useMemo(
    () => pluginSidebarPanels.find((panel) => panel.id === activeSidebarPanelId) ?? null,
    [pluginSidebarPanels, activeSidebarPanelId]
  );

  const {
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded,
    collectionsSectionVisible,
    environmentsSectionVisible,
    setCollectionsSectionVisible,
    setEnvironmentsSectionVisible,
    expandedCollectionIds,
    expandedFolderIds,
    setExpandedCollectionIds,
    setExpandedFolderIds,
    revealCollection,
    revealFolder
  } = useSidebarExpansion();

  /**
   * Writes accordion item state into the persisted sidebar expansion booleans.
   *
   * @param key - Accordion item key (`collections`, `environments`, or a plugin section id).
   * @param isEnter - Whether the section body should be expanded.
   */
  const applySectionExpanded = useCallback(
    (key: string, isEnter: boolean): void => {
      if (key === 'collections') {
        setCollectionsSectionExpanded((current) => (current === isEnter ? current : isEnter));
        return;
      }

      if (key === 'environments') {
        setEnvironmentsSectionExpanded((current) => (current === isEnter ? current : isEnter));
        return;
      }

      setPluginSectionExpanded((current) => {
        const previous = current[key] ?? true;
        if (previous === isEnter) {
          return current;
        }
        return { ...current, [key]: isEnter };
      });
    },
    [setCollectionsSectionExpanded, setEnvironmentsSectionExpanded]
  );

  const accordion = useAccordionProvider({
    allowMultiple: true,
    transition: true,
    transitionTimeout: 200,
    mountOnEnter: true,
    onStateChange: ({ key, current }) => {
      applySectionExpanded(String(key), current.isEnter);
    }
  });
  const { stateMap, toggle } = accordion;

  /**
   * Pushes programmatic expansion changes (search, reveal, hydration) into the accordion.
   * `stateMap` is read when persisted booleans change but omitted from deps so user toggles
   * do not re-trigger sync and snap sections back open.
   */
  useEffect(() => {
    const desiredExpansion: Record<string, boolean> = {};

    if (collectionsSectionVisible) {
      desiredExpansion.collections = collectionsSectionExpanded;
    }

    if (environmentsSectionVisible) {
      desiredExpansion.environments = environmentsSectionExpanded;
    }

    for (const section of pluginSidebarSections) {
      desiredExpansion[section.id] = pluginSectionExpanded[section.id] ?? true;
    }

    for (const [key, wantExpanded] of Object.entries(desiredExpansion)) {
      const isExpanded = stateMap.get(key)?.isEnter;
      if (isExpanded !== wantExpanded) {
        toggle(key, wantExpanded);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stateMap intentionally excluded; see docblock
  }, [
    toggle,
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    collectionsSectionVisible,
    environmentsSectionVisible,
    pluginSectionExpanded,
    pluginSidebarSections
  ]);

  const { searchQuery, setSearchQuery, searchFilter, searchLoading } = useSidebarSearch({
    collections,
    foldersByCollection,
    requestsByCollection,
    environments,
    collectionsSectionExpanded,
    environmentsSectionExpanded,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded,
    setCollectionsSectionVisible,
    setEnvironmentsSectionVisible,
    expandedCollectionIds,
    expandedFolderIds,
    setExpandedCollectionIds,
    setExpandedFolderIds
  });

  /**
   * Environments visible for the current sidebar search filter.
   */
  const visibleEnvironments = useMemo(() => {
    if (searchFilter == null) {
      return environments;
    }
    return environments.filter((environment) => searchFilter.environmentIds.has(environment.id));
  }, [environments, searchFilter]);

  /**
   * True when search is active but no environments matched the query.
   */
  const environmentsSearchNoMatches =
    searchFilter != null && environments.length > 0 && visibleEnvironments.length === 0;

  /**
   * Loads folders and requests when a collection chevron is expanded.
   */
  const handleExpandCollection = useCallback(
    (id: number) => {
      void dispatch(refreshCollectionContents(id));
    },
    [dispatch]
  );

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

  /**
   * Reloads collections when the git working tree changes on disk (pull or external edits).
   */
  const handleGitWorkingTreeChanged = useCallback(
    (connectionId: string): void => {
      void dispatch(refreshCollections()).then(() => {
        void window.api.listGitStatuses().then((statuses) => {
          const status = statuses[connectionId];
          if (status?.conflictCount > 0) {
            toast(
              `${status.conflictCount} merge conflict(s) in repository files. Resolve markers before editing.`,
              { icon: '⚠️', duration: 8000 }
            );
          }
        });
      });
    },
    [dispatch]
  );

  const { statuses: gitStatusesByConnectionId, refresh: refreshGitStatuses } = useGitStatuses(
    10000,
    handleGitWorkingTreeChanged
  );
  const [gitPanel, setGitPanel] = useState<{
    connectionId: string;
    connectionName: string;
  } | null>(null);
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
      <aside className="flex shrink-0 flex-col overflow-x-hidden bg-sidebar" style={{ width }}>
        {pluginSidebarPanels.length > 0 && (
          <nav
            aria-label="Sidebar panels"
            className="flex shrink-0 flex-wrap gap-1 border-b border-separator px-2 py-1.5"
          >
            <button
              type="button"
              className={`rounded px-2 py-1 text-[13px] app-no-drag ${
                activeSidebarPanelId == null
                  ? 'bg-accent/15 font-medium text-accent'
                  : 'text-muted hover:bg-control hover:text-text'
              }`}
              aria-pressed={activeSidebarPanelId == null}
              onClick={() => dispatch(setActiveSidebarPanel(null))}
            >
              Collections
            </button>
            {pluginSidebarPanels.map((panel) => (
              <button
                key={panel.id}
                type="button"
                className={`rounded px-2 py-1 text-[13px] app-no-drag ${
                  activeSidebarPanelId === panel.id
                    ? 'bg-accent/15 font-medium text-accent'
                    : 'text-muted hover:bg-control hover:text-text'
                }`}
                aria-pressed={activeSidebarPanelId === panel.id}
                title={panel.title}
                onClick={() => dispatch(setActiveSidebarPanel(panel.id))}
              >
                {panel.icon ? (
                  <span aria-hidden="true" className="mr-1">
                    {panel.icon}
                  </span>
                ) : null}
                {panel.title}
              </button>
            ))}
          </nav>
        )}
        {activeSidebarPanel ? (
          <div className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-2">
            <PluginSurface
              pluginId={activeSidebarPanel.pluginId}
              contributionId={activeSidebarPanel.contributionId}
              kind="sidebarPanels"
              minHeight={240}
            />
          </div>
        ) : (
          <>
            <SidebarSearch value={searchQuery} onChange={setSearchQuery} />
            <div className="flex-1 overflow-x-hidden overflow-y-auto px-2 pb-3">
              {searchLoading ? (
                <p className="mt-1.5 text-[14px] text-muted" role="status">
                  Loading…
                </p>
              ) : null}

              <ControlledAccordion providerValue={accordion}>
                {collectionsSectionVisible ? (
                  <nav aria-label="Collections">
                    <Section
                      itemKey="collections"
                      title="Collections"
                      initialEntered={collectionsSectionExpanded}
                      onAdd={onAddCollection}
                      addLabel="Add Collection"
                    >
                      <Collections
                        collections={collections}
                        foldersByCollection={foldersByCollection}
                        requestsByCollection={requestsByCollection}
                        searchFilter={searchFilter}
                        selectedCollectionId={selectedCollectionId}
                        selectedFolderId={selectedFolderId}
                        primaryConnectionId={primaryConnectionId}
                        connectionNamesById={connectionNamesById}
                        connectionTypesById={connectionTypesById}
                        gitStatusesByConnectionId={gitStatusesByConnectionId}
                        onOpenSourceControl={(connectionId, connectionName) =>
                          setGitPanel({ connectionId, connectionName })
                        }
                        activeRequestId={draft.id}
                        expandedCollectionIds={expandedCollectionIds}
                        expandedFolderIds={expandedFolderIds}
                        setExpandedCollectionIds={setExpandedCollectionIds}
                        setExpandedFolderIds={setExpandedFolderIds}
                        onSelectCollection={(id) => {
                          dispatch(setSelectedCollectionId(id));
                          revealCollection(id);
                        }}
                        onSelectFolder={(collectionId, folderId) => {
                          dispatch(focusSidebarItem({ collectionId, folderId }));
                          revealFolder(collectionId, folderId);
                        }}
                        onExpandCollection={handleExpandCollection}
                        onConfigureCollection={onConfigureCollection}
                        onRunCollection={(collectionId, collectionName) => {
                          dispatch(
                            openCollectionRunnerModal({
                              collectionId,
                              collectionName
                            })
                          );
                        }}
                        onRunFolder={(collectionId, folderId, collectionName, folderName) => {
                          dispatch(
                            openCollectionRunnerModal({
                              collectionId,
                              folderId,
                              collectionName,
                              folderName
                            })
                          );
                        }}
                        onDeleteCollection={async (id) => {
                          const collection = collections.find((item) => item.id === id);
                          if (collection && isTeamHubProvider(providers, collection.connectionId)) {
                            const confirmed = await showConfirm(dispatch, {
                              title: collection.deletion_locked
                                ? 'Remove collection'
                                : 'Delete collection',
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
                          } catch (err) {
                            showAlert(
                              dispatch,
                              formatErrorMessage(err, 'Failed to delete collection')
                            );
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
                            showAlert(
                              dispatch,
                              formatErrorMessage(err, 'Failed to duplicate collection')
                            );
                          }
                        }}
                        onShareCollection={onShareCollection}
                        onNewFolder={(collectionId) => {
                          setFolderModal({ mode: 'create', collectionId, name: '', error: null });
                        }}
                        onNewRequestInCollection={async (id) => {
                          try {
                            await dispatch(newRequestInCollection(id)).unwrap();
                          } catch (err) {
                            showAlert(
                              dispatch,
                              formatErrorMessage(err, 'Failed to create request')
                            );
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
                            showAlert(
                              dispatch,
                              formatErrorMessage(err, 'Failed to import request')
                            );
                          }
                        }}
                        onNewRequestInFolder={async (collectionId, folderId) => {
                          try {
                            await dispatch(newRequestInFolder({ collectionId, folderId })).unwrap();
                          } catch (err) {
                            showAlert(
                              dispatch,
                              formatErrorMessage(err, 'Failed to create request')
                            );
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
                          await dispatch(
                            reorderRequests({ collectionId, folderId, orderedRequestIds })
                          );
                        }}
                        onMoveRequest={async (collectionId, requestId, folderId, index) => {
                          await dispatch(
                            moveRequestToFolder({ collectionId, requestId, folderId, index })
                          );
                        }}
                        onLoadRequest={onLoadRequest}
                        onDeleteRequest={async (id) => {
                          await dispatch(deleteRequest(id));
                        }}
                        onDuplicateRequest={async (req) => {
                          try {
                            await dispatch(duplicateRequest(req)).unwrap();
                          } catch (err) {
                            showAlert(
                              dispatch,
                              formatErrorMessage(err, 'Failed to duplicate request')
                            );
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
                ) : null}

                {environmentsSectionVisible ? (
                  <nav aria-label="Environments">
                    <Section
                      itemKey="environments"
                      title="Environments"
                      initialEntered={environmentsSectionExpanded}
                      onAdd={() => {
                        setEnvironmentModalTab('create');
                        setNewEnvironmentName('');
                        setEnvironmentModalError(null);
                        setShowEnvironmentModal(true);
                      }}
                      addLabel="Add Environment"
                    >
                      <Environments
                        environments={visibleEnvironments}
                        activeEnvironmentId={activeEnvironmentId}
                        searchActive={searchFilter != null}
                        noMatches={environmentsSearchNoMatches}
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
                        onDuplicateEnvironment={async (id) => {
                          try {
                            await dispatch(duplicateEnvironment(id)).unwrap();
                            toast.success('Environment duplicated');
                          } catch (err) {
                            showAlert(
                              dispatch,
                              formatErrorMessage(err, 'Failed to duplicate environment')
                            );
                          }
                        }}
                        onReorderEnvironments={async (orderedEnvironmentIds) => {
                          await dispatch(reorderEnvironments({ orderedEnvironmentIds }));
                        }}
                      />
                    </Section>
                  </nav>
                ) : null}

                {pluginSidebarSections.map((section) => {
                  const expanded = pluginSectionExpanded[section.id] ?? true;
                  return (
                    <nav key={section.id} aria-label={section.title}>
                      <Section
                        itemKey={section.id}
                        title={section.title}
                        initialEntered={expanded}
                        headerActions={
                          section.hasHeaderActions ? (
                            <PluginSurface
                              pluginId={section.pluginId}
                              contributionId={section.contributionId}
                              kind="sidebarSections"
                              slot="headerActions"
                            />
                          ) : undefined
                        }
                      >
                        <PluginSurface
                          pluginId={section.pluginId}
                          contributionId={section.contributionId}
                          kind="sidebarSections"
                          minHeight={120}
                        />
                      </Section>
                    </nav>
                  );
                })}
              </ControlledAccordion>
            </div>
          </>
        )}
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
        <Modal
          onClose={closeFolderModal}
          labelledBy="sidebar-folder-modal-title"
          title={folderModal.mode === 'create' ? 'New folder' : 'Rename folder'}
        >
          <Input
            className="mt-3 w-full"
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
          {folderModal.error && <FieldError spacing="section">{folderModal.error}</FieldError>}
          <ModalFooter spaced>
            <Button
              onClick={() => void handleFolderModalSubmit()}
              disabled={!folderModal.name.trim()}
            >
              {folderModal.mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {showEnvironmentModal && (
        <Modal
          onClose={closeEnvironmentModal}
          labelledBy="sidebar-environment-modal-title"
          title="Add environment"
        >
          <SegmentedTabsGroup
            value={environmentModalTab}
            onChange={setEnvironmentModalTab}
            ariaLabel="Add environment options"
          >
            <div className="-mx-4 -mt-4 mb-4">
              <SegmentedTabs
                fullWidth
                tabs={[
                  { value: 'create', label: 'Create new' },
                  { value: 'import', label: 'Import from file' }
                ]}
              />
            </div>

            {environmentModalError && (
              <FieldError spacing="section" className="mb-3 mt-0">
                {environmentModalError}
              </FieldError>
            )}

            <SegmentedTabPanel value="create">
              <Input
                className="w-full"
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
              <ModalFooter spaced>
                <Button
                  onClick={() => void handleEnvironmentModalSubmit()}
                  disabled={!newEnvironmentName.trim()}
                >
                  Create
                </Button>
              </ModalFooter>
            </SegmentedTabPanel>

            <SegmentedTabPanel value="import">
              <p className="mb-4 text-[14px] text-muted">
                Choose a HarborClient environment export (.json) to import variables and settings.
              </p>
              <ModalFooter>
                <Button onClick={() => void handleEnvironmentImport()}>Import .json</Button>
              </ModalFooter>
            </SegmentedTabPanel>
          </SegmentedTabsGroup>
        </Modal>
      )}
      {gitPanel != null && (
        <GitSourceControlPanel
          open={true}
          connectionId={gitPanel.connectionId}
          connectionName={gitPanel.connectionName}
          status={gitStatusesByConnectionId[gitPanel.connectionId] ?? null}
          onClose={() => setGitPanel(null)}
          onRefresh={() => {
            refreshGitStatuses();
            void dispatch(refreshCollections());
          }}
        />
      )}
    </>
  );
}
