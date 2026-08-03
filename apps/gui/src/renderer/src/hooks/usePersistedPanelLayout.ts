import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  hydratePanelLayoutFromSettings,
  isPanelLayoutHydrated
} from '#/renderer/src/store/panelLayoutHydration';
import {
  selectActivePluginFooterPanelId,
  selectRequestEditorSplitHeight,
  selectResponseEditorSplit,
  selectShowAiSidebar,
  selectShowGitSidebar,
  selectShowShortcutsSidebar,
  selectShowConsole,
  selectShowMcp,
  selectShowRail,
  selectShowRequestEditor,
  selectShowResponseEditor,
  selectShowSidebar,
  selectLiveServerLogsPlacement,
  selectLiveServerLogsPlacements,
  selectShowLiveServerLogs,
  selectShowTerminal,
  selectShowVariables
} from '#/renderer/src/store/slices/navigationSlice';

/**
 * Restores and persists sidebar, AI sidebar, request/response editor, and footer panel layout preferences.
 */
export function usePersistedPanelLayout(): void {
  const dispatch = useAppDispatch();
  const showSidebar = useAppSelector(selectShowSidebar);
  const showRail = useAppSelector(selectShowRail);
  const showAiSidebar = useAppSelector(selectShowAiSidebar);
  const showGitSidebar = useAppSelector(selectShowGitSidebar);
  const showShortcutsSidebar = useAppSelector(selectShowShortcutsSidebar);
  const showRequestEditor = useAppSelector(selectShowRequestEditor);
  const showResponseEditor = useAppSelector(selectShowResponseEditor);
  const requestEditorSplitHeight = useAppSelector(selectRequestEditorSplitHeight);
  const responseEditorSplit = useAppSelector(selectResponseEditorSplit);
  const showConsole = useAppSelector(selectShowConsole);
  const showVariables = useAppSelector(selectShowVariables);
  const showMcp = useAppSelector(selectShowMcp);
  const showTerminal = useAppSelector(selectShowTerminal);
  const showLiveServerLogs = useAppSelector(selectShowLiveServerLogs);
  const liveServerLogsPlacement = useAppSelector(selectLiveServerLogsPlacement);
  const liveServerLogsPlacements = useAppSelector(selectLiveServerLogsPlacements);
  const activePluginFooterPanelId = useAppSelector(selectActivePluginFooterPanelId);
  const hydratedRef = useRef(isPanelLayoutHydrated());

  /**
   * Loads persisted panel layout on mount before writes are enabled, unless
   * shell bootstrap already hydrated layout via {@link hydratePanelLayoutFromSettings}.
   */
  useEffect(() => {
    if (isPanelLayoutHydrated()) {
      hydratedRef.current = true;
      return;
    }

    let cancelled = false;

    void hydratePanelLayoutFromSettings(dispatch).then(() => {
      if (!cancelled) {
        hydratedRef.current = true;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  /**
   * Writes panel layout preferences to disk when sidebar, editor visibility, split height, or footer panels change.
   */
  useEffect(() => {
    if (!hydratedRef.current && !isPanelLayoutHydrated()) return;
    hydratedRef.current = true;
    void window.api.setPanelLayout({
      showSidebar,
      showRail,
      showAiSidebar,
      showGitSidebar,
      showShortcutsSidebar,
      showRequestEditor,
      showResponseEditor,
      requestEditorSplitHeight,
      responseEditorSplit,
      showConsole,
      showVariables,
      showMcp,
      showTerminal,
      showLiveServerLogs,
      liveServerLogsPlacement,
      liveServerLogsPlacements,
      activePluginFooterPanelId
    });
  }, [
    showSidebar,
    showRail,
    showAiSidebar,
    showGitSidebar,
    showShortcutsSidebar,
    showRequestEditor,
    showResponseEditor,
    requestEditorSplitHeight,
    responseEditorSplit,
    showConsole,
    showVariables,
    showMcp,
    showTerminal,
    showLiveServerLogs,
    liveServerLogsPlacement,
    liveServerLogsPlacements,
    activePluginFooterPanelId
  ]);
}
