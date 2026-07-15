import { useEffect } from 'react';
import { useSidebarSelectionCoordinator } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sidebarSelectionContext';

/**
 * Keeps Edit → Deselect all menu state in sync and routes the menu action to the
 * sidebar selection coordinator.
 */
export function SidebarSelectionMenuHost(): null {
  const coordinator = useSidebarSelectionCoordinator();

  /**
   * Syncs whether Edit → Deselect all should be enabled in the application menu.
   */
  useEffect(() => {
    if (coordinator == null) {
      return;
    }
    void window.api.setSidebarDeselectAllAvailable(coordinator.hasAnySelection);
  }, [coordinator]);

  /**
   * Clears all collections sidebar selection when Edit → Deselect all is chosen.
   */
  useEffect(() => {
    if (coordinator == null) {
      return;
    }

    const unsubscribe = window.api.onMenuAction((action) => {
      if (action !== 'deselect-all-sidebar') {
        return;
      }
      coordinator.clearAllSelections();
    });

    return unsubscribe;
  }, [coordinator]);

  return null;
}
