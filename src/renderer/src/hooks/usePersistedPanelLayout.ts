import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectShowAiSidebar,
  selectShowRequestEditor,
  selectShowResponseEditor,
  selectShowSidebar,
  setShowAiSidebar,
  setShowRequestEditor,
  setShowResponseEditor,
  setShowSidebar
} from '#/renderer/src/store/slices/navigationSlice';

/**
 * Restores and persists sidebar and AI sidebar visibility preferences.
 */
export function usePersistedPanelLayout(): void {
  const dispatch = useAppDispatch();
  const showSidebar = useAppSelector(selectShowSidebar);
  const showAiSidebar = useAppSelector(selectShowAiSidebar);
  const showRequestEditor = useAppSelector(selectShowRequestEditor);
  const showResponseEditor = useAppSelector(selectShowResponseEditor);
  const hydratedRef = useRef(false);

  /**
   * Loads persisted panel layout on mount before writes are enabled.
   */
  useEffect(() => {
    let cancelled = false;

    void window.api.getPanelLayout().then((layout) => {
      if (cancelled) return;
      dispatch(setShowSidebar(layout.showSidebar));
      dispatch(setShowAiSidebar(layout.showAiSidebar));
      dispatch(setShowRequestEditor(layout.showRequestEditor));
      dispatch(setShowResponseEditor(layout.showResponseEditor));
      hydratedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  /**
   * Writes panel layout preferences to disk when sidebar or editor visibility toggles.
   */
  useEffect(() => {
    if (!hydratedRef.current) return;
    void window.api.setPanelLayout({
      showSidebar,
      showAiSidebar,
      showRequestEditor,
      showResponseEditor
    });
  }, [showSidebar, showAiSidebar, showRequestEditor, showResponseEditor]);
}
