import { createContext, useContext } from 'react';
import type { SourceControlStatus } from '#/shared/types';

/**
 * Git source-control state and actions shared with sidebar sections.
 */
export interface SidebarGitContextValue {
  /**
   * Git source-control status keyed by connection id.
   */
  gitStatusesByConnectionId: Record<string, SourceControlStatus>;

  /**
   * Opens the Git sidebar for a git connection.
   *
   * @param connectionId - Git connection id.
   * @param connectionName - Display name for the connection.
   * @param collectionUuid - Collection uuid used for git operations.
   */
  openSourceControl: (connectionId: string, connectionName: string, collectionUuid: string) => void;

  /**
   * Refreshes git status and collection data after git operations.
   */
  refreshGitSidebar: () => void;

  /**
   * Opens the create-branch modal for a git connection.
   *
   * @param connectionId - Git connection id.
   * @param connectionName - Display name for the connection.
   * @param collectionUuid - Collection uuid used for sidebar context.
   */
  openCreateBranch: (connectionId: string, connectionName: string, collectionUuid: string) => void;

  /**
   * Opens the switch-branch modal for a git connection.
   *
   * @param connectionId - Git connection id.
   * @param connectionName - Display name for the connection.
   * @param collectionUuid - Collection uuid used for sidebar context.
   */
  openSwitchBranch: (connectionId: string, connectionName: string, collectionUuid: string) => void;
}

/**
 * React context for shared git source-control status and the panel opener.
 */
export const SidebarGitContext = createContext<SidebarGitContextValue | null>(null);

/**
 * Returns shared git source-control status and the source-control opener.
 *
 * @throws When called outside `SidebarGitProvider`.
 */
export function useSidebarGit(): SidebarGitContextValue {
  const context = useContext(SidebarGitContext);
  if (!context) {
    throw new Error('useSidebarGit must be used within SidebarGitProvider');
  }
  return context;
}
