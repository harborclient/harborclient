import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  resolvePageSidebarSection,
  type UsePersistedPageSidebarSectionOptions,
  type UsePersistedPageSidebarSectionResult
} from '#/renderer/src/hooks/usePersistedPageSidebarSection.resolve';

/**
 * Loads and persists the selected sidebar section for a page tab screen.
 */
export function usePersistedPageSidebarSection<T extends string>({
  pageKey,
  defaultSection,
  isValidSection,
  navigationOverride
}: UsePersistedPageSidebarSectionOptions<T>): UsePersistedPageSidebarSectionResult<T> {
  const [selectedSection, setSelectedSection] = useState<T | null>(null);
  const [persistedSection, setPersistedSection] = useState<T | null>(null);
  const isValidSectionRef = useRef(isValidSection);

  /**
   * Keeps the section validator ref current for async persistence loads.
   */
  useEffect(() => {
    isValidSectionRef.current = isValidSection;
  }, [isValidSection]);

  /**
   * Loads persisted sidebar memory from electron-store on mount.
   */
  useEffect(() => {
    let cancelled = false;

    void window.api
      .getPageSidebarSection(pageKey)
      .then((stored) => {
        if (cancelled) {
          return;
        }
        const resolved = resolvePageSidebarSection({
          defaultSection,
          navigationOverride,
          persisted: stored,
          isValidSection: isValidSectionRef.current
        });
        setPersistedSection(resolved);
      })
      .catch(() => {
        // Keep derived defaults when IPC fails so the sidebar remains usable.
      });

    return () => {
      cancelled = true;
    };
  }, [defaultSection, navigationOverride, pageKey]);

  /**
   * Persists explicit navigation overrides requested by deep links or search.
   */
  useEffect(() => {
    if (navigationOverride == null || !isValidSection(navigationOverride)) {
      return;
    }
    void window.api.setPageSidebarSection(pageKey, navigationOverride);
  }, [isValidSection, navigationOverride, pageKey]);

  /**
   * Resolves the sidebar section to render from override, selection, and memory.
   */
  const section = useMemo(() => {
    if (navigationOverride != null && isValidSection(navigationOverride)) {
      return navigationOverride;
    }
    if (selectedSection != null && isValidSection(selectedSection)) {
      return selectedSection;
    }
    if (persistedSection != null && isValidSection(persistedSection)) {
      return persistedSection;
    }
    return defaultSection;
  }, [defaultSection, isValidSection, navigationOverride, persistedSection, selectedSection]);

  /**
   * Updates the selected section in memory and electron-store.
   */
  const setSection = useCallback(
    (next: T): void => {
      if (!isValidSectionRef.current(next)) {
        return;
      }
      setSelectedSection(next);
      void window.api.setPageSidebarSection(pageKey, next);
    },
    [pageKey]
  );

  return { section, setSection };
}
