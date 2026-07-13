import { useAccordionProvider } from '@szhsin/react-accordion';
import { useCallback, useEffect } from 'react';
import type { GitSidebarSectionKey } from '#/shared/gitSidebarExpansion';
import { useGitSidebarExpansion } from '#/renderer/src/ui/sidebars/GitSidebar/useGitSidebarExpansion';

/**
 * Accordion provider and persisted section visibility for the Git sidebar.
 */
export function useGitSidebarSections(): {
  accordion: ReturnType<typeof useAccordionProvider>;
  sections: Record<GitSidebarSectionKey, boolean>;
  sectionVisibility: Record<GitSidebarSectionKey, boolean>;
  setSectionVisible: (key: GitSidebarSectionKey, visible: boolean) => void;
} {
  const { sections, sectionVisibility, setSectionExpanded, setSectionVisible } =
    useGitSidebarExpansion();

  /**
   * Writes accordion item state into persisted Git sidebar expansion booleans.
   */
  const applySectionExpanded = useCallback(
    (key: string, isEnter: boolean): void => {
      if (key === 'commitMessage' || key === 'changes' || key === 'commits' || key === 'history') {
        setSectionExpanded(key, isEnter);
      }
    },
    [setSectionExpanded]
  );

  const accordion = useAccordionProvider({
    allowMultiple: true,
    transition: true,
    transitionTimeout: 200,
    mountOnEnter: true,
    onStateChange: ({ key, current }) => {
      applySectionExpanded(String(key), current.isEnter);
    }
  });
  const { stateMap, toggle } = accordion;

  /**
   * Pushes persisted expansion booleans into the accordion provider on load and updates.
   */
  useEffect(() => {
    (Object.keys(sections) as GitSidebarSectionKey[]).forEach((key) => {
      const wantExpanded = sections[key];
      const current = stateMap.get(key);
      if (current != null && current.isEnter !== wantExpanded) {
        toggle(key, wantExpanded);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stateMap intentionally excluded; see useSidebarAccordion
  }, [sections, toggle]);

  return {
    accordion,
    sections,
    sectionVisibility,
    setSectionVisible
  };
}
