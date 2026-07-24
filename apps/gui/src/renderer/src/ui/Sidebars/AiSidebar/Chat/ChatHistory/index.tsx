import { EmptyState, FormGroup, Input, portalToBody } from '@harborclient/sdk/components';
import { useEffect, useMemo, useRef, useState, type JSX, type RefObject } from 'react';

import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectChatHistory } from '#/renderer/src/store/slices/aiChatSlice';
import {
  filterChats,
  filterChatsWithMessages,
  groupChatsByDay,
  hasRecentDayGroups,
  splitRecentAndOlder,
  truncateFlatChats,
  truncateGroupChats,
  type ChatHistoryGroup
} from '#/renderer/src/ui/Sidebars/AiSidebar/Chat/chatHistoryGrouping';
import { ChatHistoryGroupSection } from './ChatHistoryGroupSection';
import { ChatHistoryRow } from './ChatHistoryRow';
import { ChatHistoryShowMoreButton } from './ChatHistoryShowMoreButton';

/**
 * Stable id for the portaled chat history menu element.
 */
export const AI_CHAT_HISTORY_MENU_ID = 'ai-chat-history-menu';

/**
 * Fixed width of the chat history menu in pixels (`w-80`).
 */
const MENU_WIDTH_PX = 320;

interface MenuPosition {
  top: number;
  left: number;
}

interface Props {
  /**
   * Toolbar history button used to anchor the portaled menu.
   */
  anchorRef: RefObject<HTMLElement | null>;

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
 * Computes fixed menu coordinates aligned to the right edge of the anchor button.
 *
 * @param anchor - Toolbar history button element.
 * @returns Viewport coordinates, or null when the anchor is unavailable.
 */
function getMenuPosition(anchor: HTMLElement | null): MenuPosition | null {
  if (!anchor) {
    return null;
  }

  const rect = anchor.getBoundingClientRect();
  return {
    top: rect.bottom + 2,
    left: rect.right - MENU_WIDTH_PX
  };
}

/**
 * Portaled chat history panel with search, day grouping, and row actions.
 *
 * @param anchorRef - Toolbar history button used for positioning.
 * @param onClose - Closes the history popover.
 * @param onOpenChat - Opens the selected chat from history.
 */
export function ChatHistory({ anchorRef, onClose, onOpenChat }: Props): JSX.Element | null {
  const chats = useAppSelector(selectChatHistory);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [query, setQuery] = useState('');
  const [showOlder, setShowOlder] = useState(false);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [showAllFlat, setShowAllFlat] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /**
   * Chats with at least one persisted message for the history popover.
   */
  const chatsWithMessages = useMemo(() => filterChatsWithMessages(chats), [chats]);

  /**
   * Chats matching the current search query.
   */
  const filteredChats = useMemo(
    () => filterChats(chatsWithMessages, query),
    [chatsWithMessages, query]
  );

  /**
   * Day-grouped chats derived from the filtered list.
   */
  const groups = useMemo(() => groupChatsByDay(filteredChats, new Date()), [filteredChats]);

  /**
   * Recent (Today/Yesterday) vs older day groups for pagination.
   */
  const { recent, older } = useMemo(() => splitRecentAndOlder(groups), [groups]);

  /**
   * Whether Today or Yesterday groups exist so the grouped layout can be used.
   */
  const hasRecent = useMemo(() => hasRecentDayGroups(groups), [groups]);
  const isSearching = query.trim().length > 0;

  /**
   * Groups shown in the scroll region based on search and Show more state.
   */
  const visibleGroups = useMemo((): ChatHistoryGroup[] => {
    if (isSearching || !hasRecent) {
      return groups;
    }

    return showOlder ? [...recent, ...older] : recent;
  }, [groups, hasRecent, isSearching, older, recent, showOlder]);

  /**
   * Flat chat list shown when no Today or Yesterday groups exist.
   */
  const flatHistory = useMemo(() => {
    if (isSearching || hasRecent) {
      return null;
    }

    return truncateFlatChats(filteredChats, showAllFlat);
  }, [filteredChats, hasRecent, isSearching, showAllFlat]);

  /**
   * Focuses the search field when the history panel opens.
   */
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  /**
   * Updates the search query and resets pagination state for the new filter.
   *
   * @param nextQuery - Updated search text.
   */
  const handleQueryChange = (nextQuery: string): void => {
    setQuery(nextQuery);
    setExpandedGroupKeys(new Set());
    setShowOlder(false);
    setShowAllFlat(false);
  };

  /**
   * Tracks anchor movement while the menu is open so fixed coordinates stay aligned.
   */
  useEffect(() => {
    /**
     * Updates menu position from the anchor rect.
     */
    const updatePosition = (): void => {
      setPosition(getMenuPosition(anchorRef.current));
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [anchorRef]);

  /**
   * Closes the menu on outside pointer interaction or Escape.
   */
  useEffect(() => {
    /**
     * Closes when the user activates outside the anchor and portaled menu.
     */
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const anchor = anchorRef.current;
      const menu = document.getElementById(AI_CHAT_HISTORY_MENU_ID);
      if (anchor?.contains(target) || menu?.contains(target)) {
        return;
      }

      onClose();
    };

    /**
     * Closes the menu when the user presses Escape and no row menu is open.
     */
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }

      if (openMenuId != null) {
        setOpenMenuId(null);
        return;
      }

      onClose();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onClose, openMenuId]);

  if (!position) {
    return null;
  }

  return portalToBody(
    <div
      id={AI_CHAT_HISTORY_MENU_ID}
      aria-label="Chat history"
      className="fixed z-50 flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-md border border-separator bg-sidebar shadow-md app-no-drag"
      style={{ top: position.top, left: position.left }}
    >
      <div className="shrink-0 border-b border-separator px-2 py-2">
        <FormGroup
          bordered={false}
          label="Search chat history"
          htmlFor="ai-chat-history-search"
          srOnly
        >
          <Input
            ref={searchInputRef}
            id="ai-chat-history-search"
            type="search"
            placeholder="Search chats"
            value={query}
            className="w-full"
            onChange={(event) => handleQueryChange(event.target.value)}
          />
        </FormGroup>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {chatsWithMessages.length === 0 ? (
          <EmptyState className="px-3 py-2">No previous chats</EmptyState>
        ) : filteredChats.length === 0 ? (
          <EmptyState className="px-3 py-2">No matching chats</EmptyState>
        ) : (
          <>
            {isSearching ? (
              visibleGroups.map((group) => (
                <ChatHistoryGroupSection
                  key={group.key}
                  group={group}
                  openMenuId={openMenuId}
                  onOpenMenuChange={setOpenMenuId}
                  onOpenChat={onOpenChat}
                />
              ))
            ) : hasRecent ? (
              <>
                {visibleGroups.map((group) => {
                  const isExpanded = expandedGroupKeys.has(group.key);
                  const { group: truncatedGroup, hasMore } = truncateGroupChats(group, isExpanded);

                  return (
                    <div key={group.key}>
                      <ChatHistoryGroupSection
                        group={truncatedGroup}
                        openMenuId={openMenuId}
                        onOpenMenuChange={setOpenMenuId}
                        onOpenChat={onOpenChat}
                      />
                      {hasMore ? (
                        <ChatHistoryShowMoreButton
                          label={`Show more chats from ${group.label}`}
                          onClick={() => {
                            setExpandedGroupKeys((previous) => new Set([...previous, group.key]));
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })}

                {older.length > 0 && !showOlder ? (
                  <ChatHistoryShowMoreButton
                    label="Show more chat history"
                    onClick={() => setShowOlder(true)}
                  />
                ) : null}
              </>
            ) : (
              <>
                {flatHistory?.chats.map((chat) => (
                  <ChatHistoryRow
                    key={chat.id}
                    chat={chat}
                    openMenuId={openMenuId}
                    onOpenMenuChange={setOpenMenuId}
                    onOpenChat={onOpenChat}
                  />
                ))}

                {flatHistory?.hasMore ? (
                  <ChatHistoryShowMoreButton
                    label="Show more chats"
                    onClick={() => setShowAllFlat(true)}
                  />
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
