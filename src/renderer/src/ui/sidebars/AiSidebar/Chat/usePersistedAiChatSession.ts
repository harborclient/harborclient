import { useEffect, useRef } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveChatId,
  selectEnterToSend,
  selectOpenChatTabIds
} from '#/renderer/src/store/slices/aiChatSlice';

/**
 * Persists open AI chat tabs, active tab, and composer keyboard preferences.
 */
export function usePersistedAiChatSession(): void {
  const openTabIds = useAppSelector(selectOpenChatTabIds);
  const activeChatId = useAppSelector(selectActiveChatId);
  const enterToSend = useAppSelector(selectEnterToSend);
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
   * Writes chat session state to disk when tabs, selection, or enter-to-send preference change.
   */
  useEffect(() => {
    if (!hydratedRef.current) return;
    void window.api.setAiChatSession({ openTabIds, activeChatId, enterToSend });
  }, [openTabIds, activeChatId, enterToSend]);
}
