/**
 * Persisted Git sidebar accordion section keys.
 */
export type GitSidebarSectionKey = 'commitMessage' | 'changes' | 'commits' | 'history';

/**
 * Persisted expansion and visibility state for Git sidebar sections.
 */
export interface GitSidebarExpansionState {
  /**
   * Whether each accordion section body is expanded.
   */
  sections: Record<GitSidebarSectionKey, boolean>;

  /**
   * Whether each accordion section is rendered in the sidebar.
   */
  sectionVisibility: Record<GitSidebarSectionKey, boolean>;
}

/**
 * Default Git sidebar section expansion and visibility.
 */
export const DEFAULT_GIT_SIDEBAR_EXPANSION: GitSidebarExpansionState = {
  sections: {
    commitMessage: true,
    changes: true,
    commits: true,
    history: true
  },
  sectionVisibility: {
    commitMessage: true,
    changes: true,
    commits: true,
    history: true
  }
};
