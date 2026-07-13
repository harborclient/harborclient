import { useCallback, useMemo, useState, type JSX, type ReactNode } from 'react';
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
import { refreshCollections } from '#/renderer/src/store/thunks';
import { GitCreateBranchModal } from '#/renderer/src/ui/modals/GitCreateBranchModal';
import { GitDeleteBranchModal } from '#/renderer/src/ui/modals/GitDeleteBranchModal';
import { GitSwitchBranchesModal } from '#/renderer/src/ui/modals/GitSwitchBranchesModal';
import { GitMenuActionHost } from '#/renderer/src/ui/sidebars/CollectionSidebar/GitMenuActionHost';
import {
  SidebarGitContext,
  type SidebarGitContextValue
} from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarGitContext';

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
  const [switchBranchPanel, setSwitchBranchPanel] = useState<{
    connectionId: string;
    connectionName: string;
    collectionUuid: string;
  } | null>(null);
  const [mergeBranchPanel, setMergeBranchPanel] = useState<{
    connectionId: string;
    connectionName: string;
    collectionUuid: string;
  } | null>(null);

  /**
   * Reloads collections when the git working tree changes on disk (pull or
   * external edits) and warns when merge conflicts appear.
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

  const connectionNamesById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const provider of providers) {
      map[provider.id] = provider.name;
    }
    return map;
  }, [providers]);

  const connectionTypesById = useMemo(() => providerTypesById(providers), [providers]);

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
   * Opens the Git sidebar for a git-backed collection.
   */
  const openSourceControl = useCallback(
    (connectionId: string, connectionName: string, collectionUuid: string): void => {
      void connectionId;
      void connectionName;
      void collectionUuid;
      dispatch(openGitSidebar());
    },
    [dispatch]
  );

  /**
   * Opens the create-branch modal for a git connection.
   */
  const openCreateBranch = useCallback(
    (connectionId: string, connectionName: string, collectionUuid: string): void => {
      setCreateBranchPanel({ connectionId, connectionName, collectionUuid });
    },
    []
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
   * Opens the switch-branch modal for a git connection.
   */
  const openSwitchBranch = useCallback(
    (connectionId: string, connectionName: string, collectionUuid: string): void => {
      setSwitchBranchPanel({ connectionId, connectionName, collectionUuid });
    },
    []
  );

  /**
   * Opens the merge-branch modal for a git connection.
   */
  const openMergeBranch = useCallback(
    (connectionId: string, connectionName: string, collectionUuid: string): void => {
      setMergeBranchPanel({ connectionId, connectionName, collectionUuid });
    },
    []
  );

  /**
   * Refreshes git status and collection data after a git operation.
   */
  const refreshGitSidebar = useCallback((): void => {
    refreshGitStatuses();
    void dispatch(refreshCollections());
  }, [dispatch, refreshGitStatuses]);

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
        toast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [activeGitContext, refreshGitSidebar]
  );

  /**
   * Opens the Git sidebar for the active git-backed collection.
   */
  const commitActiveCollection = useCallback((): void => {
    if (activeGitContext == null) {
      return;
    }

    openSourceControl(
      activeGitContext.connectionId,
      activeGitContext.connectionName,
      activeGitContext.collectionUuid
    );
  }, [activeGitContext, openSourceControl]);

  /**
   * Opens the merge-branch modal for the active git-backed collection.
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
   * Opens the create-branch modal for the active git-backed collection.
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
      activeGitContext,
      isActiveCollectionGit: activeGitContext != null,
      openSourceControl,
      openCreateBranch,
      openDeleteBranch,
      openSwitchBranch,
      openMergeBranch,
      refreshGitSidebar,
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
      mergeActiveCollection,
      openCreateBranch,
      openDeleteBranch,
      openMergeBranch,
      openSourceControl,
      openSwitchBranch,
      pullActiveCollection,
      pushActiveCollection,
      refreshGitSidebar
    ]
  );

  return (
    <SidebarGitContext.Provider value={value}>
      {children}
      <GitMenuActionHost />
      {createBranchPanel != null && (
        <GitCreateBranchModal
          open={true}
          connectionId={createBranchPanel.connectionId}
          connectionName={createBranchPanel.connectionName}
          onClose={() => setCreateBranchPanel(null)}
          onRefresh={refreshGitSidebar}
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
      {switchBranchPanel != null && (
        <GitSwitchBranchesModal
          open={true}
          mode="switch"
          connectionId={switchBranchPanel.connectionId}
          connectionName={switchBranchPanel.connectionName}
          status={gitStatusesByConnectionId[switchBranchPanel.connectionId] ?? null}
          onClose={() => setSwitchBranchPanel(null)}
          onRefresh={refreshGitSidebar}
        />
      )}
      {mergeBranchPanel != null && (
        <GitSwitchBranchesModal
          open={true}
          mode="merge"
          connectionId={mergeBranchPanel.connectionId}
          connectionName={mergeBranchPanel.connectionName}
          status={gitStatusesByConnectionId[mergeBranchPanel.connectionId] ?? null}
          onClose={() => setMergeBranchPanel(null)}
          onRefresh={refreshGitSidebar}
        />
      )}
    </SidebarGitContext.Provider>
  );
}
