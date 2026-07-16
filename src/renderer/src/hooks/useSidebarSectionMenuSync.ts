import { useEffect } from 'react';
import { useStore } from 'react-redux';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import type { RootState } from '#/renderer/src/store/redux';
import { focusFirstCollectionSidebar } from '#/renderer/src/ui/Sidebars/CollectionSidebar/navigation/focusFirstCollectionSidebar';
import { focusFirstEnvironmentSidebar } from '#/renderer/src/ui/Sidebars/CollectionSidebar/navigation/focusFirstEnvironmentSidebar';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';

/**
 * Handles sidebar section toggle shortcuts and focus-first-collection/environment actions.
 */
export function useSidebarSectionMenuSync(): void {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const {
    toggleCollectionsSectionVisible,
    toggleEnvironmentsSectionVisible,
    toggleRunResultsSectionVisible,
    setCollectionsSectionVisible,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionVisible,
    setEnvironmentsSectionExpanded
  } = useSidebarExpansion();

  /**
   * Handles section toggle shortcuts and sidebar list focus shortcuts.
   */
  useEffect(() => {
    const unsubscribe = window.api.onMenuAction((action) => {
      switch (action) {
        case 'toggle-collections-section':
          toggleCollectionsSectionVisible();
          break;
        case 'toggle-environments-section':
          toggleEnvironmentsSectionVisible();
          break;
        case 'toggle-run-results-section':
          toggleRunResultsSectionVisible();
          break;
        case 'focus-first-collection':
          focusFirstCollectionSidebar(dispatch, store.getState, {
            setCollectionsSectionVisible,
            setCollectionsSectionExpanded
          });
          break;
        case 'focus-first-environment':
          focusFirstEnvironmentSidebar(dispatch, store.getState, {
            setEnvironmentsSectionVisible,
            setEnvironmentsSectionExpanded
          });
          break;
      }
    });
    return unsubscribe;
  }, [
    dispatch,
    store,
    toggleCollectionsSectionVisible,
    toggleEnvironmentsSectionVisible,
    toggleRunResultsSectionVisible,
    setCollectionsSectionVisible,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionVisible,
    setEnvironmentsSectionExpanded
  ]);
}
