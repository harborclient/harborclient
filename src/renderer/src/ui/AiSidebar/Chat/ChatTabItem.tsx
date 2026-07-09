import { FaIcon, TabCloseButton } from '@harborclient/sdk/components';
import { faComment } from '#/renderer/src/fontawesome';
import { requestTabItem } from '#/renderer/src/ui/shared/classes';
import { useSortableTabItem } from '#/renderer/src/ui/shared/useSortableTabItem';
import type { JSX, KeyboardEvent, MouseEvent } from 'react';
import type { ChatSummary } from '#/shared/types';

interface Props {
  /**
   * Chat summary for tab label and id.
   */
  chat: ChatSummary;

  /**
   * Whether this tab is currently selected.
   */
  active: boolean;

  /**
   * Tab order index for the tab label; all tabs stay in sequential Tab order.
   */
  tabIndex: number;

  /**
   * Stable dnd-kit sortable id for this tab row.
   */
  sortableId: string;

  /**
   * When true, drag reordering is disabled for this tab.
   */
  sortableDisabled?: boolean;

  /**
   * Called when the user selects this tab.
   */
  onSelect: (chatId: number) => void;

  /**
   * Called when the user closes this tab.
   */
  onClose: (chatId: number) => void;

  /**
   * Called when the user opens the tab context menu.
   *
   * @param chatId - Chat tab that was right-clicked.
   * @param event - Native context menu event.
   */
  onContextMenu?: (chatId: number, event: MouseEvent<HTMLDivElement>) => void;
}

/**
 * Single chat tab in the AI sidebar tab bar.
 */
export function ChatTabItem({
  chat,
  active,
  tabIndex,
  sortableId,
  sortableDisabled = false,
  onSelect,
  onClose,
  onContextMenu
}: Props): JSX.Element {
  /**
   * Activates the tab when Enter or Space is pressed on the tab container.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(chat.id);
    }
  };

  const { setNodeRef, listeners, style } = useSortableTabItem(sortableId, sortableDisabled);

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="tab"
      id={`ai-chat-tab-${chat.id}`}
      aria-controls={`ai-chat-panel-${chat.id}`}
      aria-selected={active}
      aria-label={chat.title}
      title={chat.title}
      tabIndex={tabIndex}
      className={`group -mb-1 flex max-w-[180px] min-h-12 shrink-0 self-stretch items-stretch gap-2.5 rounded-t-lg border border-b-0 px-3 ${requestTabItem(active)} ${sortableDisabled ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
      onClick={() => onSelect(chat.id)}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu?.(chat.id, event);
      }}
      onKeyDown={handleKeyDown}
      {...(sortableDisabled ? {} : listeners)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5 py-2 text-inherit app-no-drag">
        <FaIcon icon={faComment} className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate text-[16px]">{chat.title}</span>
      </span>
      <span
        className="flex shrink-0 items-center self-center app-no-drag"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <TabCloseButton
          ariaLabel={`Close ${chat.title}`}
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onClose(chat.id);
          }}
        />
      </span>
    </div>
  );
}
