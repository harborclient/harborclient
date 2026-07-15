import type { JSX } from 'react';

import type { ChatHistoryGroup } from '#/renderer/src/ui/Sidebars/AiSidebar/Chat/chatHistoryGrouping';
import { ChatHistoryRow } from './ChatHistoryRow';

interface Props {
  /**
   * Day group to render.
   */
  group: ChatHistoryGroup;

  /**
   * Id of the open row actions menu, if any.
   */
  openMenuId: string | null;

  /**
   * Called when a row actions menu opens or closes.
   */
  onOpenMenuChange: (menuId: string | null) => void;

  /**
   * Opens the selected chat from history.
   */
  onOpenChat: (chatId: number) => void;
}

/**
 * Renders one day section with a muted heading and chat rows.
 */
export function ChatHistoryGroupSection({
  group,
  openMenuId,
  onOpenMenuChange,
  onOpenChat
}: Props): JSX.Element {
  return (
    <section aria-label={group.label}>
      <h3 className="sticky top-0 z-10 bg-sidebar-section px-3 py-2 font-medium text-muted">
        {group.label}
      </h3>
      {group.chats.map((chat) => (
        <ChatHistoryRow
          key={chat.id}
          chat={chat}
          openMenuId={openMenuId}
          onOpenMenuChange={onOpenMenuChange}
          onOpenChat={onOpenChat}
        />
      ))}
    </section>
  );
}
