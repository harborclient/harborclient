import { useEffect } from 'react';
import { useStore } from 'react-redux';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import type { RootState } from '#/renderer/src/store/redux';
import { focusFirstCollectionSidebar } from '#/renderer/src/ui/Sidebar/focusFirstCollectionSidebar';
import { focusFirstEnvironmentSidebar } from '#/renderer/src/ui/Sidebar/focusFirstEnvironmentSidebar';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebar/useSidebarExpansion';

/**
 * Keeps View menu Collections and Environments checkboxes aligned with sidebar section visibility.
 */
export function useSidebarSectionMenuSync(): void {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const {
    collectionsSectionVisible,
    environmentsSectionVisible,
    toggleCollectionsSectionVisible,
    toggleEnvironmentsSectionVisible,
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
    setCollectionsSectionVisible,
    setCollectionsSectionExpanded,
    setEnvironmentsSectionVisible,
    setEnvironmentsSectionExpanded
  ]);
}
