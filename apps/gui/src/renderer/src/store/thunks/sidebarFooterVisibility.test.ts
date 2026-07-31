import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import navigationReducer, {
  setActivePluginFooterPanelId,
  setActiveSidebarPanel,
  setShowAiSidebar,
  setShowConsole,
  setShowGitSidebar,
  setShowMcp,
  setShowSidebar,
  setShowTerminal,
  type NavigationState,
  type SidebarFooterLayoutSnapshot
} from '#/renderer/src/store/slices/navigationSlice';
import type { AppDispatch } from '#/renderer/src/store/redux';
import {
  applySidebarFooterSnapshot,
  captureSidebarFooterSnapshot,
  hideSidebarsAndFooterPanels,
  showSidebarsAndFooterPanels
} from './sidebarFooterVisibility';

/**
 * Builds a Redux store with only the navigation slice for visibility tests.
 *
 * @returns Typed store and dispatch for sidebar/footer visibility thunks.
 */
function createTestStore(): {
  dispatch: AppDispatch;
  getNavigation: () => NavigationState;
} {
  const store = configureStore({
    reducer: {
      navigation: navigationReducer
    }
  });
  return {
    dispatch: store.dispatch as AppDispatch,
    getNavigation: (): NavigationState => store.getState().navigation
  };
}

describe('captureSidebarFooterSnapshot', () => {
  it('records open sidebars, plugin panel, and footer panels', () => {
    const { dispatch, getNavigation } = createTestStore();
    dispatch(setShowSidebar(true));
    dispatch(setShowGitSidebar(true));
    dispatch(setActiveSidebarPanel('plugin-sidebar-1'));
    dispatch(setShowTerminal(true));
    dispatch(setActivePluginFooterPanelId(null));

    const snapshot = captureSidebarFooterSnapshot(getNavigation());

    expect(snapshot).toEqual({
      showSidebar: true,
      showAiSidebar: false,
      showGitSidebar: true,
      showShortcutsSidebar: false,
      activeSidebarPanelId: 'plugin-sidebar-1',
      activeSidebarRailItemId: null,
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: true,
      showLiveServerLogs: false,
      activePluginFooterPanelId: null
    } satisfies SidebarFooterLayoutSnapshot);
  });
});

describe('hideSidebarsAndFooterPanels', () => {
  it('records the current layout and closes all sidebars and footer panels', async () => {
    const { dispatch, getNavigation } = createTestStore();
    dispatch(setShowSidebar(true));
    dispatch(setShowAiSidebar(true));
    dispatch(setActiveSidebarPanel('plugin-sidebar-1'));
    dispatch(setShowConsole(true));

    await dispatch(hideSidebarsAndFooterPanels());

    const state = getNavigation();
    expect(state.sidebarFooterLayoutSnapshot).toEqual({
      showSidebar: true,
      showAiSidebar: true,
      showGitSidebar: false,
      showShortcutsSidebar: false,
      activeSidebarPanelId: 'plugin-sidebar-1',
      activeSidebarRailItemId: null,
      showConsole: true,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      showLiveServerLogs: false,
      activePluginFooterPanelId: null
    });
    expect(state.showSidebar).toBe(false);
    expect(state.showAiSidebar).toBe(false);
    expect(state.showGitSidebar).toBe(false);
    expect(state.showShortcutsSidebar).toBe(false);
    expect(state.activeSidebarPanelId).toBeNull();
    expect(state.showConsole).toBe(false);
    expect(state.showVariables).toBe(false);
    expect(state.showMcp).toBe(false);
    expect(state.showTerminal).toBe(false);
    expect(state.showLiveServerLogs).toBe(false);
    expect(state.activePluginFooterPanelId).toBeNull();
  });

  it('records an all-closed snapshot when nothing is open', async () => {
    const { dispatch, getNavigation } = createTestStore();
    dispatch(setShowSidebar(false));
    dispatch(setShowAiSidebar(false));
    dispatch(setShowGitSidebar(false));

    await dispatch(hideSidebarsAndFooterPanels());

    expect(getNavigation().sidebarFooterLayoutSnapshot).toEqual({
      showSidebar: false,
      showAiSidebar: false,
      showGitSidebar: false,
      showShortcutsSidebar: false,
      activeSidebarPanelId: null,
      activeSidebarRailItemId: null,
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      showLiveServerLogs: false,
      activePluginFooterPanelId: null
    });
  });
});

describe('showSidebarsAndFooterPanels', () => {
  it('opens only the Collections sidebar when no snapshot exists', async () => {
    const { dispatch, getNavigation } = createTestStore();
    dispatch(setShowSidebar(false));

    await dispatch(showSidebarsAndFooterPanels());

    const state = getNavigation();
    expect(state.showSidebar).toBe(true);
    expect(state.showAiSidebar).toBe(false);
    expect(state.showGitSidebar).toBe(false);
    expect(state.showConsole).toBe(false);
  });

  it('restores sidebars, plugin panel, and footer panels from a snapshot', async () => {
    const { dispatch, getNavigation } = createTestStore();
    dispatch(setShowSidebar(true));
    dispatch(setShowGitSidebar(true));
    dispatch(setActiveSidebarPanel('plugin-sidebar-1'));
    dispatch(setShowMcp(false));
    dispatch(setActivePluginFooterPanelId('plugin-footer-1'));

    await dispatch(hideSidebarsAndFooterPanels());
    await dispatch(showSidebarsAndFooterPanels());

    const state = getNavigation();
    expect(state.showSidebar).toBe(true);
    expect(state.showGitSidebar).toBe(true);
    expect(state.showAiSidebar).toBe(false);
    expect(state.activeSidebarPanelId).toBe('plugin-sidebar-1');
    expect(state.showConsole).toBe(false);
    expect(state.showVariables).toBe(false);
    expect(state.showMcp).toBe(false);
    expect(state.showTerminal).toBe(false);
    expect(state.activePluginFooterPanelId).toBe('plugin-footer-1');
  });

  it('preserves AI/Git exclusivity when restoring the AI sidebar', () => {
    const { dispatch, getNavigation } = createTestStore();

    applySidebarFooterSnapshot(dispatch, {
      showSidebar: true,
      showAiSidebar: true,
      showGitSidebar: false,
      showShortcutsSidebar: false,
      activeSidebarPanelId: null,
      activeSidebarRailItemId: null,
      showConsole: false,
      showVariables: true,
      showMcp: false,
      showTerminal: false,
      showLiveServerLogs: false,
      activePluginFooterPanelId: null
    });

    const state = getNavigation();
    expect(state.showAiSidebar).toBe(true);
    expect(state.showGitSidebar).toBe(false);
    expect(state.showVariables).toBe(true);
  });

  it('clears the plugin sidebar panel when Collections sidebar was closed in the snapshot', () => {
    const { dispatch, getNavigation } = createTestStore();
    dispatch(setActiveSidebarPanel('stale-panel'));

    applySidebarFooterSnapshot(dispatch, {
      showSidebar: false,
      showAiSidebar: false,
      showGitSidebar: true,
      showShortcutsSidebar: false,
      activeSidebarPanelId: 'plugin-sidebar-1',
      activeSidebarRailItemId: null,
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      showLiveServerLogs: false,
      activePluginFooterPanelId: null
    });

    const state = getNavigation();
    expect(state.showSidebar).toBe(false);
    expect(state.showGitSidebar).toBe(true);
    expect(state.activeSidebarPanelId).toBeNull();
  });
});
