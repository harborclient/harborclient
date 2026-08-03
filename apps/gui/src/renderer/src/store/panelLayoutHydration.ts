import { DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT } from '@harborclient/core/types';
import type { UnknownAction } from '@reduxjs/toolkit';
import {
  setActivePluginFooterPanelId,
  setRequestEditorSplitHeight,
  setResponseEditorSplit,
  setShowAiSidebar,
  setShowGitSidebar,
  setShowShortcutsSidebar,
  setShowConsole,
  setShowMcp,
  setShowRail,
  setShowRequestEditor,
  setShowResponseEditor,
  setShowSidebar,
  setLiveServerLogsPlacement,
  setLiveServerLogsPlacements,
  setShowLiveServerLogs,
  setShowTerminal,
  setShowVariables
} from '#/renderer/src/store/slices/navigationSlice';

/** Legacy localStorage key for request editor split height before electron-store migration. */
const LEGACY_REQUEST_EDITOR_HEIGHT_KEY = 'hc.requestEditorHeight';

/** True after {@link hydratePanelLayoutFromSettings} has applied persisted layout once. */
let panelLayoutHydrated = false;

/**
 * Dispatch-compatible callback used by panel layout hydration.
 *
 * Accepts plain Redux actions without requiring the full AppDispatch thunk
 * signature (which differs between store.dispatch and createAsyncThunk's
 * nested dispatch).
 */
type LayoutDispatch = (action: UnknownAction) => unknown;

/**
 * Loads a legacy request editor split height from localStorage when present.
 *
 * @returns Stored height in pixels, or null when unset or invalid.
 */
export function loadLegacyRequestEditorHeight(): number | null {
  try {
    const raw = localStorage.getItem(LEGACY_REQUEST_EDITOR_HEIGHT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.round(parsed);
  } catch {
    return null;
  }
}

/**
 * Returns whether panel layout has already been hydrated for this session.
 *
 * @returns True when {@link hydratePanelLayoutFromSettings} completed successfully.
 */
export function isPanelLayoutHydrated(): boolean {
  return panelLayoutHydrated;
}

/**
 * Resets the hydration gate for tests simulating a cold app start.
 */
export function resetPanelLayoutHydratedForTests(): void {
  panelLayoutHydrated = false;
}

/**
 * Loads persisted panel layout from electron-store and applies it to Redux.
 *
 * Safe to call multiple times; subsequent calls are no-ops once hydrated so
 * both the startup bootstrap thunk and `usePersistedPanelLayout` can share
 * this path without racing duplicate IPC loads.
 *
 * @param dispatch - Redux dispatch used to apply layout actions.
 */
export async function hydratePanelLayoutFromSettings(dispatch: LayoutDispatch): Promise<void> {
  if (panelLayoutHydrated) {
    return;
  }

  const layout = await window.api.getPanelLayout();

  let splitHeight = layout.requestEditorSplitHeight;
  const legacyHeight = loadLegacyRequestEditorHeight();
  if (splitHeight === DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT && legacyHeight != null) {
    splitHeight = legacyHeight;
  }

  dispatch(setShowSidebar(layout.showSidebar));
  dispatch(setShowRail(layout.showRail));
  if (layout.showGitSidebar) {
    dispatch(setShowGitSidebar(true));
  } else if (layout.showAiSidebar) {
    dispatch(setShowAiSidebar(true));
  } else if (layout.showShortcutsSidebar) {
    dispatch(setShowShortcutsSidebar(true));
  } else {
    dispatch(setShowAiSidebar(false));
    dispatch(setShowGitSidebar(false));
    dispatch(setShowShortcutsSidebar(false));
  }
  dispatch(setShowRequestEditor(layout.showRequestEditor));
  dispatch(setShowResponseEditor(layout.showResponseEditor));
  dispatch(setRequestEditorSplitHeight(splitHeight));
  dispatch(setResponseEditorSplit(layout.responseEditorSplit));
  dispatch(setShowConsole(layout.showConsole));
  dispatch(setShowVariables(layout.showVariables));
  dispatch(setShowMcp(layout.showMcp));
  dispatch(setShowTerminal(layout.showTerminal));
  dispatch(setLiveServerLogsPlacement(layout.liveServerLogsPlacement));
  dispatch(setLiveServerLogsPlacements(layout.liveServerLogsPlacements));
  dispatch(setShowLiveServerLogs(false));
  dispatch(setActivePluginFooterPanelId(layout.activePluginFooterPanelId));
  panelLayoutHydrated = true;

  if (legacyHeight != null && splitHeight === legacyHeight) {
    void window.api.setPanelLayout({
      showSidebar: layout.showSidebar,
      showRail: layout.showRail,
      showAiSidebar: layout.showAiSidebar,
      showGitSidebar: layout.showGitSidebar,
      showShortcutsSidebar: layout.showShortcutsSidebar,
      showRequestEditor: layout.showRequestEditor,
      showResponseEditor: layout.showResponseEditor,
      requestEditorSplitHeight: splitHeight,
      responseEditorSplit: layout.responseEditorSplit,
      showConsole: layout.showConsole,
      showVariables: layout.showVariables,
      showMcp: layout.showMcp,
      showTerminal: layout.showTerminal,
      showLiveServerLogs: false,
      liveServerLogsPlacement: layout.liveServerLogsPlacement,
      liveServerLogsPlacements: layout.liveServerLogsPlacements,
      activePluginFooterPanelId: layout.activePluginFooterPanelId
    });
    try {
      localStorage.removeItem(LEGACY_REQUEST_EDITOR_HEIGHT_KEY);
    } catch {
      // Ignore quota or privacy-mode failures.
    }
  }
}
