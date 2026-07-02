import { TabCloseButton } from '@harborclient/sdk/components';
import { requestTabItem } from '#/renderer/src/ui/shared/classes';
import type { JSX, KeyboardEvent } from 'react';
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
   * Roving tabindex for the tab control.
   */
  tabIndex: number;

  /**
   * Called when the user selects this tab.
   */
  onSelect: (chatId: number) => void;

  /**
   * Called when the user closes this tab.
   */
  onClose: (chatId: number) => void;
}

/**
 * Single chat tab in the AI sidebar tab bar.
 */
export function ChatTabItem({ chat, active, tabIndex, onSelect, onClose }: Props): JSX.Element {
  /**
   * Activates the tab when Enter or Space is pressed on the tab container.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(chat.id);
    }
  };

  return (
    <div
      role="tab"
      id={`ai-chat-tab-${chat.id}`}
      aria-controls={`ai-chat-panel-${chat.id}`}
      aria-selected={active}
      aria-label={chat.title}
      tabIndex={tabIndex}
      className={`group -mb-1 flex max-w-[180px] min-h-12 shrink-0 cursor-pointer self-stretch items-stretch gap-2.5 rounded-t-md border border-b-0 px-3 ${requestTabItem(active)}`}
      onClick={() => onSelect(chat.id)}
      onKeyDown={handleKeyDown}
    >
      <span className="flex min-w-0 flex-1 items-center py-2 text-inherit app-no-drag">
        <span className="truncate text-[14px]">{chat.title}</span>
      </span>
      <TabCloseButton
        ariaLabel={`Close ${chat.title}`}
        onClick={(event) => {
          event.stopPropagation();
          onClose(chat.id);
        }}
      />
    </div>
  );
}
