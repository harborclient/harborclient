import { useEffect, type JSX } from 'react';
import { useSidebarModals } from './sidebarModalsContext';

/**
 * Bridges File → New Environment menu actions to the add-environment modal.
 *
 * Mounted inside SidebarModalsProvider so it can call openAddEnvironment without
 * lifting environment modal state into Redux or useMenuActions.
 */
export function FileMenuEnvironmentHost(): JSX.Element | null {
  const { openAddEnvironment } = useSidebarModals();

  /**
   * Opens the add-environment modal when the File menu New Environment item is chosen.
   */
  useEffect(() => {
    const unsubscribe = window.api.onMenuAction((action) => {
      if (action === 'new-environment') {
        openAddEnvironment();
      }
    });
    return unsubscribe;
  }, [openAddEnvironment]);

  return null;
}
