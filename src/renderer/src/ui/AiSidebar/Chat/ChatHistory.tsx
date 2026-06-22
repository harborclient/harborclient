import { useEffect, useRef, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectChatHistory } from '#/renderer/src/store/slices/aiChatSlice';
import { deleteChatThunk } from '#/renderer/src/store/thunks/aiChat';

interface Props {
  /**
   * Closes the history popover.
   */
  onClose: () => void;

  /**
   * Opens the selected chat from history.
   */
  onOpenChat: (chatId: number) => void;
}

/**
 * Popover listing previous AI chats with open and delete actions.
 */
export function ChatHistory({ onClose, onOpenChat }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const chats = useAppSelector(selectChatHistory);
  const rootRef = useRef<HTMLDivElement>(null);

  /**
   * Closes the popover on outside click or Escape.
   */
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      role="menu"
      aria-label="Chat history"
      className="absolute right-0 top-full z-20 mt-0.5 max-h-64 w-64 overflow-y-auto rounded-md border border-separator bg-surface py-1 shadow-md app-no-drag"
    >
      {chats.length === 0 ? (
        <p className="m-0 px-3 py-2 text-[14px] text-muted">No previous chats</p>
      ) : (
        chats.map((chat) => (
          <div
            key={chat.id}
            className="flex items-center gap-1 border-b border-separator last:border-b-0"
          >
            <button
              type="button"
              role="menuitem"
              className="min-w-0 flex-1 cursor-pointer border-none bg-transparent px-3 py-2 text-left text-[14px] text-text hover:bg-selection app-no-drag"
              onClick={() => onOpenChat(chat.id)}
            >
              <span className="block truncate">{chat.title}</span>
            </button>
            <button
              type="button"
              className="shrink-0 cursor-pointer border-none bg-transparent px-2 py-2 text-[14px] text-danger hover:bg-danger/10 app-no-drag"
              aria-label={`Delete ${chat.title}`}
              onClick={() => void dispatch(deleteChatThunk(chat.id))}
            >
              Delete
            </button>
          </div>
        ))
      )}
    </div>
  );
}
