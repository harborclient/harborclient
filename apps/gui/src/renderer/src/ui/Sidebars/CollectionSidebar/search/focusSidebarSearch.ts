import type { AppDispatch } from '#/renderer/src/store/redux';
import { getRegisteredSidebarPanels } from '#/renderer/src/plugins/registry';
import { setActiveSidebarPanel, setShowSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { selectCollectionsReplacementPanel } from '../shell/sidebarPanelResolution';
import { focusCollectionsReplacementPanel } from '../navigation/focusCollectionsReplacementPanel';

/** Stable id of the sidebar collections search input. */
export const SIDEBAR_SEARCH_INPUT_ID = 'sidebar-search';

/**
 * Focuses the sidebar search field after ensuring the default sidebar is visible.
 *
 * When a plugin panel replaces the built-in Collections sidebar, reveals the
 * primary surface and focuses the replacement webview instead (plugins own
 * their own search UI). The built-in `#sidebar-search` input is not mounted in
 * replacement mode.
 *
 * @param dispatch - Redux dispatch used to show the sidebar.
 */
export function focusSidebarSearch(dispatch: AppDispatch): void {
  if (selectCollectionsReplacementPanel(getRegisteredSidebarPanels()) != null) {
    dispatch(setShowSidebar(true));
    dispatch(setActiveSidebarPanel(null));
    focusCollectionsReplacementPanel();
    return;
  }

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
