import { useEffect, useRef } from 'react';
import { DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT } from '#/shared/types';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActivePluginFooterPanelId,
  selectRequestEditorSplitHeight,
  selectShowAiSidebar,
  selectShowConsole,
  selectShowMcp,
  selectShowRequestEditor,
  selectShowResponseEditor,
  selectShowSidebar,
  selectShowTerminal,
  selectShowVariables,
  setActivePluginFooterPanelId,
  setRequestEditorSplitHeight,
  setShowAiSidebar,
  setShowConsole,
  setShowMcp,
  setShowRequestEditor,
  setShowResponseEditor,
  setShowSidebar,
  setShowTerminal,
  setShowVariables
} from '#/renderer/src/store/slices/navigationSlice';

/** Legacy localStorage key for request editor split height before electron-store migration. */
const LEGACY_REQUEST_EDITOR_HEIGHT_KEY = 'hc.requestEditorHeight';

/**
 * Loads a legacy request editor split height from localStorage when present.
 *
 * @returns Stored height in pixels, or null when unset or invalid.
 */
function loadLegacyRequestEditorHeight(): number | null {
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
 * Restores and persists sidebar, AI sidebar, request/response editor, and footer panel layout preferences.
 */
export function usePersistedPanelLayout(): void {
  const dispatch = useAppDispatch();
  const showSidebar = useAppSelector(selectShowSidebar);
  const showAiSidebar = useAppSelector(selectShowAiSidebar);
  const showRequestEditor = useAppSelector(selectShowRequestEditor);
  const showResponseEditor = useAppSelector(selectShowResponseEditor);
  const requestEditorSplitHeight = useAppSelector(selectRequestEditorSplitHeight);
  const showConsole = useAppSelector(selectShowConsole);
  const showVariables = useAppSelector(selectShowVariables);
  const showMcp = useAppSelector(selectShowMcp);
  const showTerminal = useAppSelector(selectShowTerminal);
  const activePluginFooterPanelId = useAppSelector(selectActivePluginFooterPanelId);
  const hydratedRef = useRef(false);

  /**
   * Loads persisted panel layout on mount before writes are enabled.
   */
  useEffect(() => {
    let cancelled = false;

    void window.api.getPanelLayout().then((layout) => {
      if (cancelled) return;

      let splitHeight = layout.requestEditorSplitHeight;
      const legacyHeight = loadLegacyRequestEditorHeight();
      if (splitHeight === DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT && legacyHeight != null) {
        splitHeight = legacyHeight;
      }

      dispatch(setShowSidebar(layout.showSidebar));
      dispatch(setShowAiSidebar(layout.showAiSidebar));
      dispatch(setShowRequestEditor(layout.showRequestEditor));
      dispatch(setShowResponseEditor(layout.showResponseEditor));
      dispatch(setRequestEditorSplitHeight(splitHeight));
      dispatch(setShowConsole(layout.showConsole));
      dispatch(setShowVariables(layout.showVariables));
      dispatch(setShowMcp(layout.showMcp));
      dispatch(setShowTerminal(layout.showTerminal));
      dispatch(setActivePluginFooterPanelId(layout.activePluginFooterPanelId));
      hydratedRef.current = true;

      if (legacyHeight != null && splitHeight === legacyHeight) {
        void window.api.setPanelLayout({
          showSidebar: layout.showSidebar,
          showAiSidebar: layout.showAiSidebar,
          showRequestEditor: layout.showRequestEditor,
          showResponseEditor: layout.showResponseEditor,
          requestEditorSplitHeight: splitHeight,
          showConsole: layout.showConsole,
          showVariables: layout.showVariables,
          showMcp: layout.showMcp,
          showTerminal: layout.showTerminal,
          activePluginFooterPanelId: layout.activePluginFooterPanelId
        });
        try {
          localStorage.removeItem(LEGACY_REQUEST_EDITOR_HEIGHT_KEY);
        } catch {
          // Ignore quota or privacy-mode failures.
        }
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
    if (!hydratedRef.current) return;
    void window.api.setPanelLayout({
      showSidebar,
      showAiSidebar,
      showRequestEditor,
      showResponseEditor,
      requestEditorSplitHeight,
      showConsole,
      showVariables,
      showMcp,
      showTerminal,
      activePluginFooterPanelId
    });
  }, [
    showSidebar,
    showAiSidebar,
    showRequestEditor,
    showResponseEditor,
    requestEditorSplitHeight,
    showConsole,
    showVariables,
    showMcp,
    showTerminal,
    activePluginFooterPanelId
  ]);
}
