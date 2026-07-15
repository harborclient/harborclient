import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_GIT_SIDEBAR_EXPANSION,
  type GitSidebarExpansionState,
  type GitSidebarSectionKey
} from '#/shared/gitSidebarExpansion';

/** localStorage key for Git sidebar section expansion and visibility. */
const STORAGE_KEY = 'hc.gitSidebarExpansion';

/**
 * Reads persisted Git sidebar expansion state from localStorage.
 *
 * @returns Parsed state or defaults when storage is unavailable.
 */
function readGitSidebarExpansion(): GitSidebarExpansionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_GIT_SIDEBAR_EXPANSION;
    }
    const parsed = JSON.parse(raw) as Partial<GitSidebarExpansionState>;
    return {
      sections: {
        ...DEFAULT_GIT_SIDEBAR_EXPANSION.sections,
        ...parsed.sections
      },
      sectionVisibility: {
        ...DEFAULT_GIT_SIDEBAR_EXPANSION.sectionVisibility,
        ...parsed.sectionVisibility
      }
    };
  } catch {
    return DEFAULT_GIT_SIDEBAR_EXPANSION;
  }
}

/**
 * Persists Git sidebar expansion state to localStorage.
 *
 * @param state - Expansion snapshot to store.
 */
function writeGitSidebarExpansion(state: GitSidebarExpansionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota or privacy-mode failures.
  }
}

/**
 * Manages persisted Git sidebar section expansion and toolbar visibility toggles.
 */
export function useGitSidebarExpansion(): {
  sections: GitSidebarExpansionState['sections'];
  sectionVisibility: GitSidebarExpansionState['sectionVisibility'];
  setSectionExpanded: (key: GitSidebarSectionKey, expanded: boolean) => void;
  setSectionVisible: (key: GitSidebarSectionKey, visible: boolean) => void;
} {
  const [state, setState] = useState<GitSidebarExpansionState>(() => readGitSidebarExpansion());

  /**
   * Persists Git sidebar expansion whenever local state changes.
   */
  useEffect(() => {
    writeGitSidebarExpansion(state);
  }, [state]);

  /**
   * Updates whether one accordion section body is expanded.
   */
  const setSectionExpanded = useCallback((key: GitSidebarSectionKey, expanded: boolean): void => {
    setState((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [key]: expanded
      }
    }));
  }, []);

  /**
   * Updates whether one accordion section is rendered in the sidebar.
   */
  const setSectionVisible = useCallback((key: GitSidebarSectionKey, visible: boolean): void => {
    setState((current) => ({
      ...current,
      sectionVisibility: {
        ...current.sectionVisibility,
        [key]: visible
      }
    }));
  }, []);

  return {
    sections: state.sections,
    sectionVisibility: state.sectionVisibility,
    setSectionExpanded,
    setSectionVisible
  };
}
