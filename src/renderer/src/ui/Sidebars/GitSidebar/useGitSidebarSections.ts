import { useCallback, useMemo } from 'react';
import type { GitSidebarSectionKey } from '#/shared/gitSidebarExpansion';
import { useGitSidebarExpansion } from './useGitSidebarExpansion';

/**
 * Accordion provider and persisted section visibility for the Git sidebar.
 */
export function useGitSidebarSections(): {
  expanded: Record<GitSidebarSectionKey, boolean>;
  onToggle: (key: string, expanded: boolean) => void;
  sectionVisibility: Record<GitSidebarSectionKey, boolean>;
  setSectionVisible: (key: GitSidebarSectionKey, visible: boolean) => void;
} {
  const { sections, sectionVisibility, setSectionExpanded, setSectionVisible } =
    useGitSidebarExpansion();

  /**
   * Writes accordion item state into persisted Git sidebar expansion booleans.
   */
  const onToggle = useCallback(
    (key: string, isEnter: boolean): void => {
      if (key === 'commitMessage' || key === 'changes' || key === 'commits') {
        setSectionExpanded(key, isEnter);
      }
    },
    [setSectionExpanded]
  );

  /**
   * Controlled expanded map fed into SDK `SidebarSections`.
   */
  const expanded = useMemo((): Record<GitSidebarSectionKey, boolean> => sections, [sections]);

  return {
    expanded,
    onToggle,
    sectionVisibility,
    setSectionVisible
  };
}
