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
   * When true, renders a non-interactive snapshot for the close animation.
   */
  exiting?: boolean;

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
  exiting = false,
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

  const { setNodeRef, listeners, style } = useSortableTabItem(
    sortableId,
    sortableDisabled || exiting
  );
  const showActive = exiting ? false : active;

  return (
    <div
      ref={exiting ? undefined : setNodeRef}
      style={exiting ? undefined : style}
      role="tab"
      id={exiting ? undefined : `ai-chat-tab-${chat.id}`}
      aria-controls={exiting ? undefined : `ai-chat-panel-${chat.id}`}
      aria-selected={showActive}
      aria-label={chat.title}
      title={chat.title}
      tabIndex={exiting ? -1 : tabIndex}
      className={`group -mb-1 flex max-w-[180px] min-h-12 shrink-0 self-stretch items-stretch gap-2.5 rounded-t-lg border border-b-2 px-3 ${requestTabItem(showActive)} ${exiting ? 'pointer-events-none' : sortableDisabled ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
      onClick={exiting ? undefined : () => onSelect(chat.id)}
      onContextMenu={
        exiting
          ? undefined
          : (event) => {
              event.preventDefault();
              onContextMenu?.(chat.id, event);
            }
      }
      onKeyDown={exiting ? undefined : handleKeyDown}
      {...(sortableDisabled || exiting ? {} : listeners)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5 py-2 text-inherit app-no-drag">
        <FaIcon icon={faComment} className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate text-[16px]">{chat.title}</span>
      </span>
      {!exiting && (
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
      )}
    </div>
  );
}
