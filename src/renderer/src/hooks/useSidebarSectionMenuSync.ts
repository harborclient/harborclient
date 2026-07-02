import { useEffect } from 'react';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebar/useSidebarExpansion';

/**
 * Keeps View menu Collections and Environments checkboxes aligned with sidebar section visibility.
 */
export function useSidebarSectionMenuSync(): void {
  const {
    collectionsSectionVisible,
    environmentsSectionVisible,
    toggleCollectionsSectionVisible,
    toggleEnvironmentsSectionVisible
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
   * Handles View menu toggles for sidebar section visibility.
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
      }
    });
    return unsubscribe;
  }, [toggleCollectionsSectionVisible, toggleEnvironmentsSectionVisible]);
}
