import { useEffect } from 'react';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { applyAiChatStreamEvent } from '#/renderer/src/store/slices/aiChatSlice';

/**
 * Installs one feature-lifetime AI chat stream subscription for the mounted chat panel.
 */
export function useAiChatStream(): void {
  const dispatch = useAppDispatch();

  /**
   * Subscribes once per mounted AI chat feature and tears down on unmount.
   */
  useEffect(() => {
    return window.api.onAiChatStream((message) => {
      dispatch(applyAiChatStreamEvent(message));
    });
  }, [dispatch]);
}
