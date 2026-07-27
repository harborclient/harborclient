import { createAsyncThunk, type Dispatch, type UnknownAction } from '@reduxjs/toolkit';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  setActivePluginFooterPanelId,
  setActiveSidebarPanel,
  setShowAiSidebar,
  setShowConsole,
  setShowGitSidebar,
  setShowMcp,
  setShowShortcutsSidebar,
  setShowSidebar,
  setShowTerminal,
  setShowVariables,
  setSidebarFooterLayoutSnapshot,
  type NavigationState,
  type SidebarFooterLayoutSnapshot
} from '#/renderer/src/store/slices/navigationSlice';

/**
 * Captures the current sidebar and footer panel visibility for later restore.
 *
 * @param navigation - Live navigation slice state.
 * @returns Session-only snapshot of sidebars, plugin sidebar panel, and footer panels.
 */
export function captureSidebarFooterSnapshot(
  navigation: NavigationState
): SidebarFooterLayoutSnapshot {
  return {
    showSidebar: navigation.showSidebar,
    showAiSidebar: navigation.showAiSidebar,
    showGitSidebar: navigation.showGitSidebar,
    showShortcutsSidebar: navigation.showShortcutsSidebar,
    activeSidebarPanelId: navigation.activeSidebarPanelId,
    showConsole: navigation.showConsole,
    showVariables: navigation.showVariables,
    showMcp: navigation.showMcp,
    showTerminal: navigation.showTerminal,
    activePluginFooterPanelId: navigation.activePluginFooterPanelId
  };
}

/**
 * Restores sidebar and footer panel visibility from a Hide sidebars snapshot.
 *
 * Applies right sidebars through their setters so mutual exclusivity stays enforced.
 * Restores the plugin Collections sidebar panel only when the Collections sidebar is shown.
 *
 * @param dispatch - Redux dispatch for panel visibility updates.
 * @param snapshot - Layout recorded by {@link hideSidebarsAndFooterPanels}.
 */
export function applySidebarFooterSnapshot(
  dispatch: Dispatch<UnknownAction>,
  snapshot: SidebarFooterLayoutSnapshot
): void {
  dispatch(setShowSidebar(snapshot.showSidebar));

  if (snapshot.showGitSidebar) {
    dispatch(setShowGitSidebar(true));
  } else if (snapshot.showAiSidebar) {
    dispatch(setShowAiSidebar(true));
  } else if (snapshot.showShortcutsSidebar) {
    dispatch(setShowShortcutsSidebar(true));
  } else {
    dispatch(setShowAiSidebar(false));
    dispatch(setShowGitSidebar(false));
    dispatch(setShowShortcutsSidebar(false));
  }

  dispatch(setActiveSidebarPanel(snapshot.showSidebar ? snapshot.activeSidebarPanelId : null));

  dispatch(setShowConsole(snapshot.showConsole));
  dispatch(setShowVariables(snapshot.showVariables));
  dispatch(setShowMcp(snapshot.showMcp));
  dispatch(setShowTerminal(snapshot.showTerminal));
  dispatch(setActivePluginFooterPanelId(snapshot.activePluginFooterPanelId));
}

/**
 * Records open sidebars and footer panels, then closes all of them.
 */
export const hideSidebarsAndFooterPanels = createAsyncThunk<void, void, ThunkApiConfig>(
  'navigation/hideSidebarsAndFooterPanels',
  async (_arg, { dispatch, getState }) => {
    const snapshot = captureSidebarFooterSnapshot(getState().navigation);
    dispatch(setSidebarFooterLayoutSnapshot(snapshot));

    dispatch(setShowSidebar(false));
    dispatch(setShowAiSidebar(false));
    dispatch(setShowGitSidebar(false));
    dispatch(setShowShortcutsSidebar(false));
    dispatch(setActiveSidebarPanel(null));
    dispatch(setShowConsole(false));
    dispatch(setShowVariables(false));
    dispatch(setShowMcp(false));
    dispatch(setShowTerminal(false));
    dispatch(setActivePluginFooterPanelId(null));
  }
);

/**
 * Restores the last Hide sidebars snapshot, or opens the Collections sidebar when none exists.
 */
export const showSidebarsAndFooterPanels = createAsyncThunk<void, void, ThunkApiConfig>(
  'navigation/showSidebarsAndFooterPanels',
  async (_arg, { dispatch, getState }) => {
    const snapshot = getState().navigation.sidebarFooterLayoutSnapshot;
    if (snapshot == null) {
      dispatch(setShowSidebar(true));
      return;
    }

    applySidebarFooterSnapshot(dispatch, snapshot);
  }
);
