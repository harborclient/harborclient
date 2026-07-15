import { useCallback, useEffect, useMemo, useState, type JSX, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { useGitStatuses } from '#/renderer/src/hooks/useGitStatuses';
import { useProviders, providerTypesById } from '#/renderer/src/hooks/useProviders';
import {
  resolveCollectionGitContext,
  resolveGitSidebarCollectionId
} from '#/renderer/src/git/resolveCollectionGitContext';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { openGitSidebar } from '#/renderer/src/store/slices/navigationSlice';
import {
  selectCollections,
  selectDraft,
  selectSelectedCollectionId
} from '#/renderer/src/store/selectors';
import { refreshCollections, refreshGitWorkingTreeContents } from '#/renderer/src/store/thunks';
import { formatIpcErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { GitBranchesModal } from '#/renderer/src/ui/Modals/GitBranchesModal';
import { GitCreateBranchModal } from '#/renderer/src/ui/Modals/GitCreateBranchModal';
import { GitDeleteBranchModal } from '#/renderer/src/ui/Modals/GitDeleteBranchModal';
import { GitMenuActionHost } from './GitMenuActionHost';
import { SidebarGitContext, type SidebarGitContextValue } from './sidebarGitContext';

interface ProviderProps {
  /**
   * Application subtree that reads git status or opens the Git sidebar.
   */
  children: ReactNode;
}

/**
 * Polls git status for mounted git connections, owns branch modals, and exposes
 * git actions to the collection sidebar and Git sidebar.
 */
export function SidebarGitProvider({ children }: ProviderProps): JSX.Element {
  const dispatch = useAppDispatch();
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const draft = useAppSelector(selectDraft);
  const collections = useAppSelector(selectCollections);
  const { providers, primaryProviderId } = useProviders();
  const [branchesPanel, setBranchesPanel] = useState<{
    connectionId: string;
    connectionName: string;
    collectionUuid: string;
    mode: 'branches' | 'merge';
  } | null>(null);
  const [createBranchPanel, setCreateBranchPanel] = useState<{
    connectionId: string;
    connectionName: string;
    collectionUuid: string;
  } | null>(null);
  const [deleteBranchPanel, setDeleteBranchPanel] = useState<{
    connectionId: string;
    connectionName: string;
    collectionUuid: string;
  } | null>(null);
  const [branchesReloadToken, setBranchesReloadToken] = useState(0);
  const [itemGitStatusByUuid, setItemGitStatusByUuid] = useState<
    Record<string, import('#/shared/types').GitRequestFileStatus>
  >({});
  const [changedItemCountByCollectionUuid, setChangedItemCountByCollectionUuid] = useState<
    Record<string, number>
  >({});

  /**
   * Reloads collections when the git working tree changes on disk (pull or
   * external edits), refreshes cached sidebar contents, and warns when merge
   * conflicts appear.
   */
  const handleGitWorkingTreeChanged = useCallback(
    (connectionId: string): void => {
      void dispatch(refreshGitWorkingTreeContents(connectionId))
        .unwrap()
        .then((result) => {
          if (result.refreshedCachedCollectionCount > 0) {
            toast('Collection files updated from disk', { icon: '📁', duration: 4000 });
          }

          void window.api.listGitStatuses().then((statuses) => {
            const status = statuses[connectionId];
            if (status?.conflictCount > 0) {
              toast(
                `${status.conflictCount} merge conflict(s) in repository files. Resolve markers before editing.`,
                { icon: '⚠️', duration: 8000 }
              );
            }
          });
        })
        .catch(() => {
          // Keep last-known sidebar state; the next poll or focus will retry.
        });
    },
    [dispatch]
  );

  const { statuses: gitStatusesByConnectionId, refresh: refreshGitStatuses } = useGitStatuses(
    10000,
    handleGitWorkingTreeChanged
  );

  const connectionNamesById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const provider of providers) {
      map[provider.id] = provider.name;
    }
    return map;
  }, [providers]);

  const connectionTypesById = useMemo(() => providerTypesById(providers), [providers]);

  /**
   * Reloads per-item git status for all git-backed collections in the sidebar.
   */
  const refreshItemGitStatuses = useCallback(async (): Promise<void> => {
    const gitCollections = collections.filter((collection) => {
      const connectionId = collection.connectionId ?? primaryProviderId;
      return connectionTypesById[connectionId] === 'git';
    });

    if (gitCollections.length === 0) {
      await Promise.resolve();
      setItemGitStatusByUuid({});
      setChangedItemCountByCollectionUuid({});
      return;
    }

    const merged: Record<string, import('#/shared/types').GitRequestFileStatus> = {};
    const countsByCollectionUuid: Record<string, number> = {};
    await Promise.all(
      gitCollections.map(async (collection) => {
        const connectionId = collection.connectionId ?? primaryProviderId;
        try {
          const [statuses, changedCount] = await Promise.all([
            window.api.gitListItemStatuses(connectionId, collection.uuid),
            window.api.gitChangedItemCount(connectionId, collection.uuid)
          ]);
          Object.assign(merged, statuses);
          countsByCollectionUuid[collection.uuid] = changedCount;
        } catch (err) {
          console.error(`Failed to load git item statuses for "${collection.name}":`, err);
        }
      })
    );
    setItemGitStatusByUuid(merged);
    setChangedItemCountByCollectionUuid(countsByCollectionUuid);
  }, [collections, connectionTypesById, primaryProviderId]);

  /**
   * Reloads per-item git status when collections or connection-level git status changes.
   */
  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        void refreshItemGitStatuses();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refreshItemGitStatuses, gitStatusesByConnectionId]);

  const activeCollectionId = resolveGitSidebarCollectionId(
    selectedCollectionId,
    draft.collection_id
  );
  const activeGitContext = useMemo(
    () =>
      resolveCollectionGitContext({
        collectionId: activeCollectionId,
        collections,
        primaryConnectionId: primaryProviderId,
        connectionNamesById,
        connectionTypesById,
        gitStatusesByConnectionId
      }),
    [
      activeCollectionId,
      collections,
      connectionNamesById,
      connectionTypesById,
      gitStatusesByConnectionId,
      primaryProviderId
    ]
  );

  /**
   * Opens the Git sidebar.
   */
  const openSourceControl = useCallback((): void => {
    dispatch(openGitSidebar());
  }, [dispatch]);

  /**
   * Opens the unified branches modal for a git connection.
   *
   * @param mode - Whether the modal should switch/create branches or merge into the current branch.
   */
  const openBranches = useCallback(
    (
      connectionId: string,
      connectionName: string,
      collectionUuid: string,
      mode: 'branches' | 'merge'
    ): void => {
      setBranchesPanel({ connectionId, connectionName, collectionUuid, mode });
    },
    []
  );

  /**
   * Opens the unified branches modal for creating or switching branches.
   */
  const openCreateBranch = useCallback(
    (connectionId: string, connectionName: string, collectionUuid: string): void => {
      openBranches(connectionId, connectionName, collectionUuid, 'branches');
    },
    [openBranches]
  );

  /**
   * Opens the delete-branch modal for a git connection.
   */
  const openDeleteBranch = useCallback(
    (connectionId: string, connectionName: string, collectionUuid: string): void => {
      setDeleteBranchPanel({ connectionId, connectionName, collectionUuid });
    },
    []
  );

  /**
   * Opens the unified branches modal for switching branches.
   */
  const openSwitchBranch = useCallback(
    (connectionId: string, connectionName: string, collectionUuid: string): void => {
      openBranches(connectionId, connectionName, collectionUuid, 'branches');
    },
    [openBranches]
  );

  /**
   * Opens the unified branches modal for merging into the current branch.
   */
  const openMergeBranch = useCallback(
    (connectionId: string, connectionName: string, collectionUuid: string): void => {
      openBranches(connectionId, connectionName, collectionUuid, 'merge');
    },
    [openBranches]
  );

  /**
   * Refreshes git status and collection data after a git operation.
   */
  const refreshGitSidebar = useCallback((): void => {
    refreshGitStatuses();
    void dispatch(refreshCollections());
    void refreshItemGitStatuses();
  }, [dispatch, refreshGitStatuses, refreshItemGitStatuses]);

  /**
   * Stages one request or markdown document in a git-backed collection.
   */
  const stageItem = useCallback(
    async (connectionId: string, collectionUuid: string, itemUuid: string): Promise<void> => {
      try {
        await window.api.gitStageItem(connectionId, collectionUuid, itemUuid);
        refreshGitSidebar();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [refreshGitSidebar]
  );

  /**
   * Unstages one request or markdown document in a git-backed collection.
   */
  const unstageItem = useCallback(
    async (connectionId: string, collectionUuid: string, itemUuid: string): Promise<void> => {
      try {
        await window.api.gitUnstageItem(connectionId, collectionUuid, itemUuid);
        refreshGitSidebar();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [refreshGitSidebar]
  );

  /**
   * Runs a remote sync action for the active git-backed collection.
   *
   * @param label - User-facing operation label for success toasts.
   * @param action - Git sync operation to execute.
   */
  const runActiveSyncAction = useCallback(
    async (label: string, action: (connectionId: string) => Promise<void>): Promise<void> => {
      if (activeGitContext == null) {
        return;
      }

      try {
        await action(activeGitContext.connectionId);
        refreshGitSidebar();
        toast.success(`${label} completed`);
      } catch (err) {
        refreshGitSidebar();
        showAlert(dispatch, formatIpcErrorMessage(err, `${label} failed`), `${label} failed`, {
          action: {
            kind: 'openCollectionGitSettings',
            label: 'Open Git settings',
            collectionId: activeGitContext.collectionId
          }
        });
      }
    },
    [activeGitContext, dispatch, refreshGitSidebar]
  );

  /**
   * Opens the Git sidebar for commit workflows on the active collection.
   *
   * Menu items and action commands gate visibility via `isActiveCollectionGit`;
   * no resolved git context is required because this only toggles navigation.
   */
  const commitActiveCollection = useCallback((): void => {
    dispatch(openGitSidebar());
  }, [dispatch]);

  /**
   * Opens the unified branches modal for the active git-backed collection.
   */
  const mergeActiveCollection = useCallback((): void => {
    if (activeGitContext == null) {
      return;
    }

    openMergeBranch(
      activeGitContext.connectionId,
      activeGitContext.connectionName,
      activeGitContext.collectionUuid
    );
  }, [activeGitContext, openMergeBranch]);

  /**
   * Opens the unified branches modal for the active git-backed collection.
   */
  const createBranchActiveCollection = useCallback((): void => {
    if (activeGitContext == null) {
      return;
    }

    openCreateBranch(
      activeGitContext.connectionId,
      activeGitContext.connectionName,
      activeGitContext.collectionUuid
    );
  }, [activeGitContext, openCreateBranch]);

  /**
   * Opens the delete-branch modal for the active git-backed collection.
   */
  const deleteBranchActiveCollection = useCallback((): void => {
    if (activeGitContext == null) {
      return;
    }

    openDeleteBranch(
      activeGitContext.connectionId,
      activeGitContext.connectionName,
      activeGitContext.collectionUuid
    );
  }, [activeGitContext, openDeleteBranch]);

  /**
   * Fetches from the remote for the active git-backed collection.
   */
  const fetchActiveCollection = useCallback(async (): Promise<void> => {
    await runActiveSyncAction('Fetch', (connectionId) => window.api.gitFetch(connectionId));
  }, [runActiveSyncAction]);

  /**
   * Pulls remote changes for the active git-backed collection.
   */
  const pullActiveCollection = useCallback(async (): Promise<void> => {
    await runActiveSyncAction('Pull', (connectionId) => window.api.gitPull(connectionId));
  }, [runActiveSyncAction]);

  /**
   * Pushes local commits for the active git-backed collection.
   */
  const pushActiveCollection = useCallback(async (): Promise<void> => {
    await runActiveSyncAction('Push', (connectionId) => window.api.gitPush(connectionId));
  }, [runActiveSyncAction]);

  const value = useMemo<SidebarGitContextValue>(
    () => ({
      gitStatusesByConnectionId,
      itemGitStatusByUuid,
      changedItemCountByCollectionUuid,
      activeGitContext,
      isActiveCollectionGit: activeGitContext != null,
      openSourceControl,
      openCreateBranch,
      openDeleteBranch,
      openSwitchBranch,
      openMergeBranch,
      refreshGitSidebar,
      refreshGitStatuses,
      stageItem,
      unstageItem,
      commitActiveCollection,
      mergeActiveCollection,
      createBranchActiveCollection,
      deleteBranchActiveCollection,
      fetchActiveCollection,
      pullActiveCollection,
      pushActiveCollection
    }),
    [
      activeGitContext,
      commitActiveCollection,
      createBranchActiveCollection,
      deleteBranchActiveCollection,
      fetchActiveCollection,
      gitStatusesByConnectionId,
      itemGitStatusByUuid,
      changedItemCountByCollectionUuid,
      mergeActiveCollection,
      openCreateBranch,
      openDeleteBranch,
      openMergeBranch,
      openSourceControl,
      openSwitchBranch,
      pullActiveCollection,
      pushActiveCollection,
      refreshGitSidebar,
      refreshGitStatuses,
      stageItem,
      unstageItem
    ]
  );

  return (
    <SidebarGitContext.Provider value={value}>
      {children}
      <GitMenuActionHost />
      {branchesPanel != null && (
        <GitBranchesModal
          open={true}
          connectionId={branchesPanel.connectionId}
          connectionName={branchesPanel.connectionName}
          status={gitStatusesByConnectionId[branchesPanel.connectionId] ?? null}
          mode={branchesPanel.mode}
          reloadToken={branchesReloadToken}
          onClose={() => setBranchesPanel(null)}
          onRefresh={refreshGitSidebar}
          onCreateBranch={
            branchesPanel.mode === 'branches'
              ? () => {
                  setCreateBranchPanel({
                    connectionId: branchesPanel.connectionId,
                    connectionName: branchesPanel.connectionName,
                    collectionUuid: branchesPanel.collectionUuid
                  });
                }
              : undefined
          }
        />
      )}
      {createBranchPanel != null && (
        <GitCreateBranchModal
          open={true}
          connectionId={createBranchPanel.connectionId}
          connectionName={createBranchPanel.connectionName}
          onClose={() => setCreateBranchPanel(null)}
          onRefresh={() => {
            refreshGitSidebar();
            setBranchesReloadToken((token) => token + 1);
          }}
        />
      )}
      {deleteBranchPanel != null && (
        <GitDeleteBranchModal
          open={true}
          connectionId={deleteBranchPanel.connectionId}
          connectionName={deleteBranchPanel.connectionName}
          status={gitStatusesByConnectionId[deleteBranchPanel.connectionId] ?? null}
          onClose={() => setDeleteBranchPanel(null)}
          onRefresh={refreshGitSidebar}
        />
      )}
    </SidebarGitContext.Provider>
  );
}
