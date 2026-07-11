import { useEffect } from 'react';
import { useStore } from 'react-redux';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import type { RootState } from '#/renderer/src/store/redux';
import { focusFirstCollectionSidebar } from '#/renderer/src/ui/sidebars/CollectionSidebar/focusFirstCollectionSidebar';
import { focusFirstEnvironmentSidebar } from '#/renderer/src/ui/sidebars/CollectionSidebar/focusFirstEnvironmentSidebar';
import { useSidebarExpansion } from '#/renderer/src/ui/sidebars/CollectionSidebar/useSidebarExpansion';

/**
 * Keeps View menu Collections, Environments, and Run Results checkboxes aligned with sidebar section visibility.
 */
export function useSidebarSectionMenuSync(): void {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const {
    collectionsSectionVisible,
    environmentsSectionVisible,
    runResultsSectionVisible,
    toggleCollectionsSectionVisible,
    toggleEnvironmentsSectionVisible,
    toggleRunResultsSectionVisible,
    setCollectionsSectionVisible,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionVisible,
    setEnvironmentsSectionExpanded
  } = useSidebarExpansion();

  /**
   * Syncs Collections section visibility to the View menu checkbox.
   */
  useEffect(() => {
    void window.api.setMenuCollectionsVisible(collectionsSectionVisible);
  }, [collectionsSectionVisible]);

  /**
   * Syncs Environments section visibility to the View menu checkbox.
   */
  useEffect(() => {
    void window.api.setMenuEnvironmentsVisible(environmentsSectionVisible);
  }, [environmentsSectionVisible]);

  /**
   * Syncs Run Results section visibility to the View menu checkbox.
   */
  useEffect(() => {
    void window.api.setMenuRunResultsVisible(runResultsSectionVisible);
  }, [runResultsSectionVisible]);

  /**
   * Handles View menu toggles and sidebar list focus shortcuts.
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
