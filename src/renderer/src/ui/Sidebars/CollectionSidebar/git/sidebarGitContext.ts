import { createContext, useContext } from 'react';
import type { CollectionGitContext } from '#/renderer/src/git/resolveCollectionGitContext';
import type { GitRequestFileStatus, SourceControlStatus } from '#/shared/types';

/**
 * Git source-control state and actions shared with sidebar sections.
 */
export interface SidebarGitContextValue {
  /**
   * Git source-control status keyed by connection id.
   */
  gitStatusesByConnectionId: Record<string, SourceControlStatus>;

  /**
   * Per-request and per-document git status keyed by item uuid.
   */
  itemGitStatusByUuid: Record<string, GitRequestFileStatus>;

  /**
   * Count of changed request/document items per collection uuid, matching the
   * Git sidebar Changes list scope for each collection.
   */
  changedItemCountByCollectionUuid: Record<string, number>;

  /**
   * Resolved git context for the active collection, when git-backed.
   */
  activeGitContext: CollectionGitContext | null;

  /**
   * Whether the active collection is git-backed.
   */
  isActiveCollectionGit: boolean;

  /**
   * Opens the Git sidebar.
   */
  openSourceControl: () => void;

  /**
   * Refreshes git status and collection data after git operations.
   */
  refreshGitSidebar: () => void;

  /**
   * Refreshes only the connection-level git statuses (branch, ahead/behind, and
   * change counts) without reloading collections or per-item statuses.
   *
   * Cheaper than {@link refreshGitSidebar} and safe to call on view mount, so the
   * Commit button's change counts stay in sync with the freshly loaded Changes
   * diff instead of lagging behind the periodic status poll.
   */
  refreshGitStatuses: () => void;

  /**
   * Stages one request or markdown document in a git-backed collection.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   * @param itemUuid - Stable request or document uuid.
   */
  stageItem: (connectionId: string, collectionUuid: string, itemUuid: string) => Promise<void>;

  /**
   * Stages every untracked request and markdown document in a git-backed collection.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   */
  stageAllUntrackedItems: (connectionId: string, collectionUuid: string) => Promise<void>;

  /**
   * Unstages one request or markdown document in a git-backed collection.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   * @param itemUuid - Stable request or document uuid.
   */
  unstageItem: (connectionId: string, collectionUuid: string, itemUuid: string) => Promise<void>;

  /**
   * Opens the unified branches modal for a git connection.
   *
   * @param connectionId - Git connection id.
   * @param connectionName - Display name for the connection.
   * @param collectionUuid - Collection uuid used for sidebar context.
   */
  openCreateBranch: (connectionId: string, connectionName: string, collectionUuid: string) => void;

  /**
   * Opens the unified branches modal for a git connection.
   *
   * @param connectionId - Git connection id.
   * @param connectionName - Display name for the connection.
   * @param collectionUuid - Collection uuid used for sidebar context.
   */
  openSwitchBranch: (connectionId: string, connectionName: string, collectionUuid: string) => void;

  /**
   * Opens the unified branches modal for a git connection.
   *
   * @param connectionId - Git connection id.
   * @param connectionName - Display name for the connection.
   * @param collectionUuid - Collection uuid used for sidebar context.
   */
  openMergeBranch: (connectionId: string, connectionName: string, collectionUuid: string) => void;

  /**
   * Opens the delete-branch modal for a git connection.
   *
   * @param connectionId - Git connection id.
   * @param connectionName - Display name for the connection.
   * @param collectionUuid - Collection uuid used for sidebar context.
   */
  openDeleteBranch: (connectionId: string, connectionName: string, collectionUuid: string) => void;

  /**
   * Opens the Git sidebar for the active git-backed collection.
   */
  commitActiveCollection: () => void;

  /**
   * Opens the unified branches modal for the active git-backed collection.
   */
  mergeActiveCollection: () => void;

  /**
   * Opens the unified branches modal for the active git-backed collection.
   */
  createBranchActiveCollection: () => void;

  /**
   * Opens the delete-branch modal for the active git-backed collection.
   */
  deleteBranchActiveCollection: () => void;

  /**
   * Fetches from the remote for the active git-backed collection.
   */
  fetchActiveCollection: () => Promise<void>;

  /**
   * Pulls remote changes for the active git-backed collection.
   */
  pullActiveCollection: () => Promise<void>;

  /**
   * Pushes local commits for the active git-backed collection.
   */
  pushActiveCollection: () => Promise<void>;
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
