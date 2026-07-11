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
   * Opens the in-app source-control panel for a git connection.
   */
  openSourceControl: (connectionId: string, connectionName: string) => void;
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
