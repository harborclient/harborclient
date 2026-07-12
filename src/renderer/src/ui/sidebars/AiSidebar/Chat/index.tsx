import { FaIcon } from '@harborclient/sdk/components';
import { useEffect, type JSX } from 'react';
import type { AiSettings } from '#/shared/types';
import { faComment } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveChatId,
  selectMessagesByChat,
  selectSelectedModelByChat,
  selectSendingByChat
} from '#/renderer/src/store/slices/aiChatSlice';
import { initializeAiChat } from '#/renderer/src/store/thunks/aiChat';
import { ChatComposer } from './ChatComposer';
import { ChatTabBar } from './ChatTabBar';
import { MessageList } from './MessageList';
import { usePersistedAiChatSession } from './usePersistedAiChatSession';

interface Props {
  /**
   * AI provider settings for model availability and initialization.
   */
  aiSettings: AiSettings;
}

/**
 * Tabbed AI chat panel with history, messages, and composer.
 */
export function AiChat({ aiSettings }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const activeChatId = useAppSelector(selectActiveChatId);
  const messagesByChat = useAppSelector(selectMessagesByChat);
  const selectedModelByChat = useAppSelector(selectSelectedModelByChat);
  const sendingByChat = useAppSelector(selectSendingByChat);

  /**
   * Loads chat history and opens the most recent chat on first mount.
   */
  useEffect(() => {
    void dispatch(initializeAiChat(aiSettings));
  }, [dispatch, aiSettings]);

  /**
   * Persists open chat tabs and active selection whenever session state changes.
   */
  usePersistedAiChatSession();

  const activeMessages = activeChatId != null ? (messagesByChat[activeChatId] ?? []) : [];
  const selectedModel = activeChatId != null ? selectedModelByChat[activeChatId] : undefined;
  const sending = activeChatId != null ? Boolean(sendingByChat[activeChatId]) : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatTabBar aiSettings={aiSettings} />
      {activeChatId != null ? (
        <div
          role="tabpanel"
          id={`ai-chat-panel-${activeChatId}`}
          aria-labelledby={`ai-chat-tab-${activeChatId}`}
          className="flex min-h-0 flex-1 flex-col"
        >
          <MessageList messages={activeMessages} sending={sending} />
          <ChatComposer
            chatId={activeChatId}
            aiSettings={aiSettings}
            selectedModel={selectedModel}
            sending={sending}
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-4">
          <div
            role="status"
            aria-label="Open or create a chat to begin."
            className="flex flex-col items-center gap-3 text-muted"
          >
            <FaIcon icon={faComment} className="h-12 w-12" aria-hidden />
            <p className="m-0">Open or create a chat to begin.</p>
          </div>
        </div>
      )}
    </div>
  );
}
