import { FaIcon, resolveTabListKeyAction } from '@harborclient/sdk/components';
import { useMemo, type JSX, type KeyboardEvent } from 'react';
import type { AiSettings } from '#/shared/types';

import { faClockRotateLeft, faPlus } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveChatId,
  selectChatHistory,
  selectHistoryOpen,
  selectOpenChatTabIds
} from '#/renderer/src/store/slices/aiChatSlice';
import { closeChat, createNewChat, openExistingChat } from '#/renderer/src/store/thunks/aiChat';
import { setActiveChat, setHistoryOpen } from '#/renderer/src/store/slices/aiChatSlice';
import { ChatHistory } from './ChatHistory';
import { ChatTabItem } from './ChatTabItem';

interface Props {
  /**
   * AI provider settings used when creating new chats.
   */
  aiSettings: AiSettings;
}

/**
 * Tab bar for open AI chats with new-chat and history controls.
 */
export function ChatTabBar({ aiSettings }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const chatHistory = useAppSelector(selectChatHistory);
  const openTabIds = useAppSelector(selectOpenChatTabIds);
  const activeChatId = useAppSelector(selectActiveChatId);
  const historyOpen = useAppSelector(selectHistoryOpen);

  /**
   * Open tabs enriched with titles from chat history.
   */
  const openTabs = useMemo(
    () =>
      openTabIds
        .map((id) => chatHistory.find((chat) => chat.id === id))
        .filter((chat): chat is NonNullable<typeof chat> => chat != null),
    [chatHistory, openTabIds]
  );

  /**
   * Moves focus and selection across open chat tabs with arrow, Home, and End keys.
   */
  const handleTabListKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (activeChatId == null) return;

    const currentIndex = openTabs.findIndex((tab) => tab.id === activeChatId);
    const nextIndex = resolveTabListKeyAction(event.key, currentIndex, openTabs.length);
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = openTabs[nextIndex];
    dispatch(setActiveChat(nextTab.id));

    requestAnimationFrame(() => {
      document.getElementById(`ai-chat-tab-${nextTab.id}`)?.focus();
    });
  };

  return (
    <div className="relative z-10 flex shrink-0 items-end gap-0 border-b border-separator bg-sidebar px-2 py-1 app-no-drag">
      <div
        role="tablist"
        aria-label="Open AI chats"
        className="flex min-w-0 flex-1 items-end overflow-x-auto overflow-y-hidden"
        onKeyDown={handleTabListKeyDown}
      >
        {openTabs.map((chat) => (
          <ChatTabItem
            key={chat.id}
            chat={chat}
            active={chat.id === activeChatId}
            tabIndex={chat.id === activeChatId ? 0 : -1}
            onSelect={(chatId) => dispatch(setActiveChat(chatId))}
            onClose={(chatId) => void dispatch(closeChat(chatId))}
          />
        ))}
      </div>
      <div className="relative flex shrink-0 items-end gap-0.5 px-1 -mb-1">
        <button
          type="button"
          className="hc-tab-bar-icon-button mb-2.5 inline-flex shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-[14px] text-muted hover:bg-selection hover:text-text focus-visible:bg-selection focus-visible:text-text app-no-drag"
          title="Chat history"
          aria-label="Chat history"
          aria-haspopup="menu"
          aria-expanded={historyOpen}
          onClick={() => dispatch(setHistoryOpen(!historyOpen))}
        >
          <FaIcon icon={faClockRotateLeft} className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="hc-tab-bar-icon-button mb-2.5 inline-flex shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-[14px] text-muted hover:bg-selection hover:text-text focus-visible:bg-selection focus-visible:text-text app-no-drag"
          title="New chat"
          aria-label="New chat"
          onClick={() => void dispatch(createNewChat(aiSettings))}
        >
          <FaIcon icon={faPlus} className="h-3.5 w-3.5" />
        </button>
        {historyOpen && (
          <ChatHistory
            onClose={() => dispatch(setHistoryOpen(false))}
            onOpenChat={(chatId) => {
              dispatch(setHistoryOpen(false));
              void dispatch(openExistingChat(chatId));
            }}
          />
        )}
      </div>
    </div>
  );
}
