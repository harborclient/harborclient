import { useEffect, useRef } from 'react';
import { unloadAllPlugins } from '#/renderer/src/plugins/pluginLoader';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { getDirtyTabs } from '#/renderer/src/store/drafts';
import { setQuitPrompt } from '#/renderer/src/store/slices/modalsSlice';
import { selectTabs } from '#/renderer/src/store/selectors';

/**
 * Subscribes to main-process before-close events and prompts when tabs have unsaved edits.
 */
export function useBeforeClose(): void {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector(selectTabs);
  const warnWhenExitingWithUnsavedChanges = useAppSelector(
    (state) => state.settings.general.warnWhenExitingWithUnsavedChanges
  );
  const tabsRef = useRef(tabs);
  const warnWhenExitingRef = useRef(warnWhenExitingWithUnsavedChanges);

  /**
   * Keeps the latest tabs list available to the before-close handler without resubscribing.
   */
  useEffect(() => {
    tabsRef.current = tabs;
  });

  /**
   * Keeps the latest exit-warning preference available to the before-close handler.
   */
  useEffect(() => {
    warnWhenExitingRef.current = warnWhenExitingWithUnsavedChanges;
  });

  /**
   * Confirms window close when no tabs are dirty; otherwise shows the quit prompt.
   */
  useEffect(() => {
    const unsubscribe = window.api.onBeforeClose(() => {
      const dirtyTabs = warnWhenExitingRef.current ? getDirtyTabs(tabsRef.current) : [];
      if (dirtyTabs.length > 0) {
        dispatch(setQuitPrompt(dirtyTabs.map((tab) => tab.draft.name)));
        return;
      }
      void unloadAllPlugins().finally(() => {
        window.api.confirmClose(true);
      });
    });
    return unsubscribe;
  }, [dispatch]);
}
