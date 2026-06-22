import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectShowAiSidebar,
  selectShowSidebar,
  setShowAiSidebar,
  setShowSidebar
} from '#/renderer/src/store/slices/navigationSlice';

/**
 * Restores and persists sidebar and AI sidebar visibility preferences.
 */
export function usePersistedPanelLayout(): void {
  const dispatch = useAppDispatch();
  const showSidebar = useAppSelector(selectShowSidebar);
  const showAiSidebar = useAppSelector(selectShowAiSidebar);
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
      hydratedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  /**
   * Writes panel layout preferences to disk when sidebar visibility toggles.
   */
  useEffect(() => {
    if (!hydratedRef.current) return;
    void window.api.setPanelLayout({ showSidebar, showAiSidebar });
  }, [showSidebar, showAiSidebar]);
}
