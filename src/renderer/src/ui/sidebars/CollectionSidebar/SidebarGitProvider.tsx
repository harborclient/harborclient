import { useCallback, useMemo, useState, type JSX, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { useGitStatuses } from '#/renderer/src/hooks/useGitStatuses';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { refreshCollections } from '#/renderer/src/store/thunks';
import { GitSourceControlPanel } from '#/renderer/src/ui/modals/GitSourceControlPanel';
import {
  SidebarGitContext,
  type SidebarGitContextValue
} from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarGitContext';

interface ProviderProps {
  /**
   * Sidebar subtree that reads git status or opens the source-control panel.
   */
  children: ReactNode;
}

/**
 * Polls git status for mounted git connections, owns the source-control panel,
 * and exposes status plus an opener to the sidebar tree.
 */
export function SidebarGitProvider({ children }: ProviderProps): JSX.Element {
  const dispatch = useAppDispatch();
  const [gitPanel, setGitPanel] = useState<{
    connectionId: string;
    connectionName: string;
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
   * Opens the source-control panel for a git connection.
   */
  const openSourceControl = useCallback((connectionId: string, connectionName: string): void => {
    setGitPanel({ connectionId, connectionName });
  }, []);

  const value = useMemo<SidebarGitContextValue>(
    () => ({ gitStatusesByConnectionId, openSourceControl }),
    [gitStatusesByConnectionId, openSourceControl]
  );

  return (
    <SidebarGitContext.Provider value={value}>
      {children}
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
    </SidebarGitContext.Provider>
  );
}
