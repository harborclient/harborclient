import { useEffect } from 'react';
import { useStore } from 'react-redux';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import type { RootState } from '#/renderer/src/store/redux';
import { focusFirstCollectionSidebar } from '#/renderer/src/ui/Sidebars/CollectionSidebar/navigation/focusFirstCollectionSidebar';
import { focusFirstEnvironmentSidebar } from '#/renderer/src/ui/Sidebars/CollectionSidebar/navigation/focusFirstEnvironmentSidebar';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';

/**
 * Handles sidebar mode shortcuts and focus-first-collection/environment actions.
 * Also syncs sidebar display Appearance checkboxes and handles their menu actions.
 */
export function useSidebarSectionMenuSync(): void {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const {
    setActiveSidebarMode,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded,
    showStorageLocationBadges,
    showMarkers,
    showMethodColors,
    showIndicators,
    showFilters,
    showSorting,
    toggleStorageLocationBadges,
    toggleMarkers,
    toggleMethodColors,
    toggleIndicators,
    toggleFilters,
    toggleSorting
  } = useSidebarExpansion();

  /**
   * Keeps the View > Appearance submenu Storage locations checkbox aligned with preference state.
   */
  useEffect(() => {
    void window.api.setMenuStorageLocationsVisible(showStorageLocationBadges);
  }, [showStorageLocationBadges]);

  /**
   * Keeps the View > Appearance submenu Color markers checkbox aligned with preference state.
   */
  useEffect(() => {
    void window.api.setMenuColorMarkersVisible(showMarkers);
  }, [showMarkers]);

  /**
   * Keeps the View > Appearance submenu Highlights checkbox aligned with preference state.
   */
  useEffect(() => {
    void window.api.setMenuHighlightsVisible(showMethodColors);
  }, [showMethodColors]);

  /**
   * Keeps the View > Appearance submenu Indicators checkbox aligned with preference state.
   */
  useEffect(() => {
    void window.api.setMenuIndicatorsVisible(showIndicators);
  }, [showIndicators]);

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
   * Handles sidebar mode shortcuts, display toggles, and sidebar list focus shortcuts.
   */
  useEffect(() => {
    const unsubscribe = window.api.onMenuAction((action) => {
      switch (action) {
        case 'toggle-collections-section':
          setActiveSidebarMode('collections');
          break;
        case 'toggle-environments-section':
          setActiveSidebarMode('environments');
          break;
        case 'toggle-run-results-section':
          setActiveSidebarMode('collections');
          break;
        case 'toggle-storage-locations':
          toggleStorageLocationBadges();
          break;
        case 'toggle-color-markers':
          toggleMarkers();
          break;
        case 'toggle-highlights':
          toggleMethodColors();
          break;
        case 'toggle-indicators':
          toggleIndicators();
          break;
        case 'toggle-filters':
          toggleFilters();
          break;
        case 'toggle-sorting':
          toggleSorting();
          break;
        case 'focus-first-collection':
          focusFirstCollectionSidebar(dispatch, store.getState, {
            setActiveSidebarMode,
            setCollectionsSectionExpanded
          });
          break;
        case 'focus-first-environment':
          focusFirstEnvironmentSidebar(dispatch, store.getState, {
            setActiveSidebarMode,
            setEnvironmentsSectionExpanded
          });
          break;
      }
    });
    return unsubscribe;
  }, [
    dispatch,
    store,
    setActiveSidebarMode,
    toggleStorageLocationBadges,
    toggleMarkers,
    toggleMethodColors,
    toggleIndicators,
    toggleFilters,
    toggleSorting,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionExpanded
  ]);
}
