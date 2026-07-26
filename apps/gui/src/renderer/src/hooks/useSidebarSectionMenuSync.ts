import { useEffect } from 'react';
import { useStore } from 'react-redux';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import type { RootState } from '#/renderer/src/store/redux';
import { focusFirstCollectionSidebar } from '#/renderer/src/ui/Sidebars/CollectionSidebar/navigation/focusFirstCollectionSidebar';
import { focusFirstEnvironmentSidebar } from '#/renderer/src/ui/Sidebars/CollectionSidebar/navigation/focusFirstEnvironmentSidebar';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';

/**
 * Handles sidebar section toggle shortcuts and focus-first-collection/environment actions.
 * Also syncs Filters/Sorting Appearance checkboxes and handles their menu actions.
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
    setEnvironmentsSectionExpanded,
    showFilters,
    showSorting,
    toggleFilters,
    toggleSorting
  } = useSidebarExpansion();

  /**
   * Keeps the View > Appearance submenu Filters checkbox aligned with preference state.
   */
  useEffect(() => {
    void window.api.setMenuFiltersVisible(showFilters);
  }, [showFilters]);

  /**
   * Keeps the View > Appearance submenu Sorting checkbox aligned with preference state.
   */
  useEffect(() => {
    void window.api.setMenuSortingVisible(showSorting);
  }, [showSorting]);

  /**
   * Handles section toggle shortcuts, filter/sort toggles, and sidebar list focus shortcuts.
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
        case 'toggle-filters':
          toggleFilters();
          break;
        case 'toggle-sorting':
          toggleSorting();
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
    toggleFilters,
    toggleSorting,
    setCollectionsSectionVisible,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionVisible,
    setEnvironmentsSectionExpanded
  ]);
}
