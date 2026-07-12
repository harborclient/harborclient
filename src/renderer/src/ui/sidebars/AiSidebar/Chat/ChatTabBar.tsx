import { Scrollbars } from '#/renderer/src/components/Scrollbars';
import { FaIcon, TabBar as SdkTabBar, buildTabCloseMenuGroups } from '@harborclient/sdk/components';
import { useMemo, type JSX, type ReactNode } from 'react';
import type { AiSettings } from '#/shared/types';

import { faComment } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectWrapTabs } from '#/renderer/src/store/slices/settingsSlice';
import {
  reorderChatTabs,
  selectActiveChatId,
  selectChatHistory,
  selectOpenChatTabIds,
  setActiveChat
} from '#/renderer/src/store/slices/aiChatSlice';
import { closeChat, createNewChat } from '#/renderer/src/store/thunks/aiChat';
import { chatIdsWithMessages } from '#/renderer/src/ui/shared/tabContextMenuHelpers';

interface Props {
  /**
   * AI provider settings for model availability when creating a new chat.
   */
  aiSettings: AiSettings;
}

/**
 * Tab bar for open AI chats.
 */
export function ChatTabBar({ aiSettings }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const chatHistory = useAppSelector(selectChatHistory);
  const openTabIds = useAppSelector(selectOpenChatTabIds);
  const activeChatId = useAppSelector(selectActiveChatId);
  const wrapTabs = useAppSelector(selectWrapTabs);
  const messagesByChat = useAppSelector((state) => state.aiChat.messagesByChat);

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
   * Maps open chats into SDK tab bar rows.
   */
  const tabBarItems = useMemo(
    () =>
      openTabs.map((chat) => ({
        id: chat.id,
        active: chat.id === activeChatId,
        accessibleName: chat.title,
        closeAccessibleName: `Close ${chat.title}`,
        title: chat.title,
        dragLabel: (
          <>
            <FaIcon icon={faComment} className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {chat.title}
          </>
        ),
        content: (
          <>
            <FaIcon icon={faComment} className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{chat.title}</span>
          </>
        )
      })),
    [activeChatId, openTabs]
  );

  /**
   * Wraps the tab row in the app horizontal scrollbar when tabs do not wrap.
   */
  const renderScrollContainer = (row: ReactNode): ReactNode => (
    <Scrollbars axis="horizontal" className="hc-tab-bar-scroll relative z-10 shrink-0">
      {row}
    </Scrollbars>
  );

  return (
    <SdkTabBar
      tabs={tabBarItems}
      activeId={activeChatId ?? -1}
      wrap={wrapTabs}
      ariaLabel="Open AI chats"
      tabIdPrefix="ai-chat-tab-"
      panelIdPrefix="ai-chat-panel-"
      sortablePrefix="ai-chat-tab-sort:"
      className="relative z-10"
      maxTabWidthClass="max-w-[180px]"
      newTab={{
        ariaLabel: 'New chat',
        title: 'New chat',
        onClick: () => {
          void dispatch(createNewChat(aiSettings));
        }
      }}
      onSelect={(chatId) => dispatch(setActiveChat(chatId))}
      onClose={(chatId) => void dispatch(closeChat(chatId))}
      onReorder={(orderedIds) => dispatch(reorderChatTabs(orderedIds))}
      buildContextMenuGroups={(targetId, orderedIds) =>
        buildTabCloseMenuGroups(orderedIds, targetId, {
          onClose: (chatId) => {
            void dispatch(closeChat(chatId));
          },
          onCloseMany: (chatIds) => {
            for (const chatId of chatIds) {
              void dispatch(closeChat(chatId));
            }
          },
          onCloseSaved: () => {
            for (const chatId of chatIdsWithMessages(openTabIds, messagesByChat)) {
              void dispatch(closeChat(chatId));
            }
          }
        })
      }
      onFocusTab={(chatId) => {
        document.getElementById(`ai-chat-tab-${chatId}`)?.focus();
      }}
      renderScrollContainer={wrapTabs ? undefined : renderScrollContainer}
    />
  );
}
