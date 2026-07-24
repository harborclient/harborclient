import { FaIcon, RowActionsMenu } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { faComment } from '#/renderer/src/fontawesome';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { deleteChatThunk } from '#/renderer/src/store/thunks/aiChat';
import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled
} from '#/renderer/src/ui/Shared/devInspectContextMenu';
import type { ChatSummary } from '#/shared/types';

interface Props {
  /**
   * Chat summary rendered in this row.
   */
  chat: ChatSummary;

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
 * Single chat row with an open action and a hover-revealed actions menu.
 */
export function ChatHistoryRow({
  chat,
  openMenuId,
  onOpenMenuChange,
  onOpenChat
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const developerToolsEnabled = useDeveloperToolsEnabled();
  const menuId = `chat-history-${chat.id}`;

  return (
    <div className="group relative mx-1 flex items-center rounded-md hover:bg-selection focus-within:bg-selection">
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 truncate border-none bg-transparent px-2 py-2 text-left text-text app-no-drag"
        onClick={() => onOpenChat(chat.id)}
      >
        <FaIcon icon={faComment} className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{chat.title}</span>
      </button>
      <div
        className={`shrink-0 pr-0.5 ${
          openMenuId === menuId
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <RowActionsMenu
          menuId={menuId}
          openMenuId={openMenuId}
          onOpenChange={onOpenMenuChange}
          groups={[
            [
              {
                label: 'Delete',
                variant: 'danger',
                onSelect: () => void dispatch(deleteChatThunk(chat.id))
              }
            ],
            ...buildDevInspectMenuGroups(undefined, menuId, developerToolsEnabled)
          ]}
        />
      </div>
    </div>
  );
}
