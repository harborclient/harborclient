import { useCallback, useMemo, useState, type JSX, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { useGitStatuses } from '#/renderer/src/hooks/useGitStatuses';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { openGitSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { refreshCollections } from '#/renderer/src/store/thunks';
import { GitCreateBranchModal } from '#/renderer/src/ui/modals/GitCreateBranchModal';
import { GitSwitchBranchesModal } from '#/renderer/src/ui/modals/GitSwitchBranchesModal';
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
  const [createBranchPanel, setCreateBranchPanel] = useState<{
    connectionId: string;
    connectionName: string;
    collectionUuid: string;
  } | null>(null);
  const [switchBranchPanel, setSwitchBranchPanel] = useState<{
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
   * Opens the switch-branch modal for a git connection.
   */
  const openSwitchBranch = useCallback(
    (connectionId: string, connectionName: string, collectionUuid: string): void => {
      setSwitchBranchPanel({ connectionId, connectionName, collectionUuid });
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

  const value = useMemo<SidebarGitContextValue>(
    () => ({
      gitStatusesByConnectionId,
      openSourceControl,
      openCreateBranch,
      openSwitchBranch,
      refreshGitSidebar
    }),
    [
      gitStatusesByConnectionId,
      openCreateBranch,
      openSourceControl,
      openSwitchBranch,
      refreshGitSidebar
    ]
  );

  return (
    <SidebarGitContext.Provider value={value}>
      {children}
      {createBranchPanel != null && (
        <GitCreateBranchModal
          open={true}
          connectionId={createBranchPanel.connectionId}
          connectionName={createBranchPanel.connectionName}
          onClose={() => setCreateBranchPanel(null)}
          onRefresh={refreshGitSidebar}
        />
      )}
      {switchBranchPanel != null && (
        <GitSwitchBranchesModal
          open={true}
          connectionId={switchBranchPanel.connectionId}
          connectionName={switchBranchPanel.connectionName}
          status={gitStatusesByConnectionId[switchBranchPanel.connectionId] ?? null}
          onClose={() => setSwitchBranchPanel(null)}
          onRefresh={refreshGitSidebar}
        />
      )}
    </SidebarGitContext.Provider>
  );
}
