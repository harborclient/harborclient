import type { AppDispatch } from '#/renderer/src/store/redux';
import { setActiveSidebarPanel, setShowSidebar } from '#/renderer/src/store/slices/navigationSlice';

/** Stable id of the sidebar collections search input. */
export const SIDEBAR_SEARCH_INPUT_ID = 'sidebar-search';

/**
 * Focuses the sidebar search field after ensuring the default sidebar is visible.
 *
 * @param dispatch - Redux dispatch used to show the sidebar.
 */
export function focusSidebarSearch(dispatch: AppDispatch): void {
  dispatch(setShowSidebar(true));
  dispatch(setActiveSidebarPanel(null));

  /**
   * Waits two animation frames so React can mount the sidebar search input.
   */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById(SIDEBAR_SEARCH_INPUT_ID)?.focus();
    });
  });
}
