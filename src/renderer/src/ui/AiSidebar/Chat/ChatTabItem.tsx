import type { JSX, KeyboardEvent } from 'react';
import type { ChatSummary } from '#/shared/types';
import { TabCloseButton } from '#/renderer/src/components/TabCloseButton';
import { requestTabItem } from '#/renderer/src/ui/shared/classes';

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
      className={`group -mb-1 flex max-w-[180px] shrink-0 cursor-pointer self-stretch items-stretch gap-1.5 rounded-t-md border border-b-0 px-3 py-2 ${requestTabItem(active)}`}
      onClick={() => onSelect(chat.id)}
      onKeyDown={handleKeyDown}
    >
      <span className="min-w-0 flex-1 truncate text-[14px]">{chat.title}</span>
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
