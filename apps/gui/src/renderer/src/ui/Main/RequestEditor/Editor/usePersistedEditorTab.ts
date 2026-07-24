import { useCallback, useEffect, useRef, useState } from 'react';
import { requestEditorTabKey, resolveEditorTab } from '#/shared/requestEditorTab';
import type { EditorTab } from '#/shared/types';
import type { RequestDraft } from '#/renderer/src/store/tabs';
import { isPluginTabId } from '#/renderer/src/plugins/pluginContextAdapters';

interface Options {
  /**
   * Current request draft being edited.
   */
  draft: RequestDraft;

  /**
   * Open tab id for unsaved draft keying.
   */
  tabId: string;

  /**
   * Whether the Body tab is available for the current method.
   */
  showBody: boolean;

  /**
   * Called when a persisted tab is loaded from storage.
   */
  onTabResolved?: (tab: string) => void;
}

interface Result {
  /**
   * Resolved editor tab for display (Body falls back when hidden).
   */
  tab: string;

  /**
   * Persists and updates the selected editor tab.
   */
  setTab: (tab: string) => void;
}

/**
 * Loads and persists the request editor tab per request via electron-store.
 */
export function usePersistedEditorTab({ draft, tabId, showBody, onTabResolved }: Options): Result {
  const [tab, setTabState] = useState<string>('params');
  const tabRef = useRef(tab);
  const onTabResolvedRef = useRef(onTabResolved);

  /**
   * Keeps the tab-resolved callback ref current for async persistence loads.
   */
  useEffect(() => {
    onTabResolvedRef.current = onTabResolved;
  }, [onTabResolved]);

  /**
   * Keeps a ref in sync with tab state for persistence after first save.
   */
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  const storageKey = requestEditorTabKey(draft, tabId);
  const previousDraftIdRef = useRef(draft.id);

  /**
   * Loads the persisted editor tab when the open tab changes.
   */
  useEffect(() => {
    let cancelled = false;
    const key = requestEditorTabKey(draft, tabId);

    void window.api
      .getRequestEditorTab(key)
      .then((stored) => {
        if (cancelled) return;
        const resolved = resolveEditorTab(stored, showBody);
        setTabState(resolved);
        onTabResolvedRef.current?.(resolved);
      })
      .catch(() => {
        // Keep the default tab when IPC fails so the editor remains usable.
      });

    return () => {
      cancelled = true;
    };
    // Reload only when switching open tabs; draft.id changes after save must not reset the tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draft/showBody are correct on mount via editor key remount
  }, [tabId]);

  /**
   * Migrates tab persistence from unsaved tab key to saved request id on first save.
   */
  useEffect(() => {
    const previousId = previousDraftIdRef.current;
    previousDraftIdRef.current = draft.id;

    if (draft.id == null || previousId != null) return;

    if (!isPluginTabId(tabRef.current)) {
      void window.api.setRequestEditorTab(String(draft.id), tabRef.current as EditorTab);
    }
    void window.api.deleteRequestEditorTab(requestEditorTabKey({}, tabId));
  }, [draft.id, tabId]);

  /**
   * Updates the selected tab in memory and electron-store.
   */
  const setTab = useCallback(
    (next: string) => {
      setTabState(next);
      if (!isPluginTabId(next)) {
        void window.api.setRequestEditorTab(storageKey, next as EditorTab);
      }
    },
    [storageKey]
  );

  const effectiveTab = tab === 'body' && !showBody ? 'params' : tab;

  return { tab: effectiveTab, setTab };
}
