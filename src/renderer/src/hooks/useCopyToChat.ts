import { useCallback } from 'react';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveChatId,
  setPendingComposerText
} from '#/renderer/src/store/slices/aiChatSlice';
import { setShowAiSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { createNewChat } from '#/renderer/src/store/thunks/aiChat';

/** Display text for the copy-to-chat keyboard shortcut shown in selection toolbars. */
export const COPY_TO_CHAT_SHORTCUT_HINT = 'Ctrl+Shift+O';

/** CodeMirror keymap binding for the copy-to-chat selection action. */
export const COPY_TO_CHAT_SHORTCUT_CODEMIRROR_KEY = 'Ctrl-Shift-o';

/** Lowercase letter key used by xterm custom key handlers for copy-to-chat. */
export const COPY_TO_CHAT_SHORTCUT_LETTER = 'o';

/**
 * Opens the AI sidebar and queues an `@` reference token in the chat composer.
 *
 * Creates a new chat when none is active, matching the script editor "Copy to chat" flow.
 */
export function useCopyToChat(): {
  /**
   * Whether AI chat is configured and available.
   */
  aiAvailable: boolean;

  /**
   * Opens the AI sidebar and inserts the given reference token into the composer.
   *
   * @param token - Compact `@` reference such as `@request.<uuid>`.
   */
  copyToChat: (token: string) => Promise<void>;
} {
  const dispatch = useAppDispatch();
  const { aiAvailable, aiSettings } = useAiAvailability();
  const activeChatId = useAppSelector(selectActiveChatId);

  /**
   * Opens the AI sidebar, ensures a chat tab exists, and queues composer text.
   */
  const copyToChat = useCallback(
    async (token: string): Promise<void> => {
      dispatch(setShowAiSidebar(true));
      if (activeChatId == null) {
        await dispatch(createNewChat(aiSettings));
      }

      dispatch(setPendingComposerText(token));
    },
    [activeChatId, aiSettings, dispatch]
  );

  return { aiAvailable, copyToChat };
}
