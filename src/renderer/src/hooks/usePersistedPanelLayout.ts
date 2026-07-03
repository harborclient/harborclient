import { useEffect, useRef } from 'react';
import { DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT } from '#/shared/types';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectRequestEditorSplitHeight,
  selectShowAiSidebar,
  selectShowRequestEditor,
  selectShowResponseEditor,
  selectShowSidebar,
  setRequestEditorSplitHeight,
  setShowAiSidebar,
  setShowRequestEditor,
  setShowResponseEditor,
  setShowSidebar
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
 * Restores and persists sidebar, AI sidebar, and request/response editor layout preferences.
 */
export function usePersistedPanelLayout(): void {
  const dispatch = useAppDispatch();
  const showSidebar = useAppSelector(selectShowSidebar);
  const showAiSidebar = useAppSelector(selectShowAiSidebar);
  const showRequestEditor = useAppSelector(selectShowRequestEditor);
  const showResponseEditor = useAppSelector(selectShowResponseEditor);
  const requestEditorSplitHeight = useAppSelector(selectRequestEditorSplitHeight);
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
      hydratedRef.current = true;

      if (legacyHeight != null && splitHeight === legacyHeight) {
        void window.api.setPanelLayout({
          showSidebar: layout.showSidebar,
          showAiSidebar: layout.showAiSidebar,
          showRequestEditor: layout.showRequestEditor,
          showResponseEditor: layout.showResponseEditor,
          requestEditorSplitHeight: splitHeight
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
   * Writes panel layout preferences to disk when sidebar, editor visibility, or split height changes.
   */
  useEffect(() => {
    if (!hydratedRef.current) return;
    void window.api.setPanelLayout({
      showSidebar,
      showAiSidebar,
      showRequestEditor,
      showResponseEditor,
      requestEditorSplitHeight
    });
  }, [showSidebar, showAiSidebar, showRequestEditor, showResponseEditor, requestEditorSplitHeight]);
}
