import { useEffect, useRef } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectActiveChatId, selectOpenChatTabIds } from '#/renderer/src/store/slices/aiChatSlice';

/**
 * Persists open AI chat tabs and the active tab whenever session state changes.
 */
export function usePersistedAiChatSession(): void {
  const openTabIds = useAppSelector(selectOpenChatTabIds);
  const activeChatId = useAppSelector(selectActiveChatId);
  const hydratedRef = useRef(false);

  /**
   * Skips the initial empty-state write until chat tabs have been restored or created.
   */
  useEffect(() => {
    if (openTabIds.length > 0 || activeChatId != null) {
      hydratedRef.current = true;
    }
  }, [openTabIds, activeChatId]);

  /**
   * Writes chat tab session state to disk when tabs or selection change.
   */
  useEffect(() => {
    if (!hydratedRef.current) return;
    void window.api.setAiChatSession({ openTabIds, activeChatId });
  }, [openTabIds, activeChatId]);
}
