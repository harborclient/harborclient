import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { FaIcon, resolveTabListKeyAction } from '@harborclient/sdk/components';
import { useMemo, useState, type JSX, type KeyboardEvent } from 'react';

import { faComment } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  reorderChatTabs,
  selectActiveChatId,
  selectChatHistory,
  selectOpenChatTabIds,
  setActiveChat
} from '#/renderer/src/store/slices/aiChatSlice';
import { closeChat } from '#/renderer/src/store/thunks/aiChat';
import { ChatTabItem } from './ChatTabItem';

/** Prefix for AI chat tab label element ids. */
const AI_CHAT_TAB_ID_PREFIX = 'ai-chat-tab-';

/** Prefix for AI chat sortable drag ids. */
const AI_CHAT_TAB_SORT_PREFIX = 'ai-chat-tab-sort:';

/**
 * Builds a stable dnd-kit sortable id for an AI chat tab.
 *
 * @param chatId - Open chat id.
 */
function aiChatTabSortableId(chatId: number): string {
  return `${AI_CHAT_TAB_SORT_PREFIX}${chatId}`;
}

/**
 * Parses an AI chat sortable drag id back to its numeric chat id.
 *
 * @param dragId - Sortable id from dnd-kit.
 */
function parseAiChatTabSortableId(dragId: string): number | null {
  if (!dragId.startsWith(AI_CHAT_TAB_SORT_PREFIX)) {
    return null;
  }
  const chatId = Number.parseInt(dragId.slice(AI_CHAT_TAB_SORT_PREFIX.length), 10);
  return Number.isNaN(chatId) ? null : chatId;
}

/**
 * Resolves the chat tab list index for arrow-key navigation from keyboard focus.
 *
 * Uses the focused tab label when focus is inside a tab row; falls back to the
 * active chat when focus is elsewhere in the tab list.
 *
 * @param openTabs - Open chat tabs in display order.
 * @param activeChatId - Currently selected chat id, if any.
 * @returns Index into `openTabs`, or `-1` when none apply.
 */
function resolveFocusedChatTabIndex(
  openTabs: { id: number }[],
  activeChatId: number | null
): number {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    const tabElement = activeElement.closest('[role="tab"]');
    if (tabElement instanceof HTMLElement && tabElement.id.startsWith(AI_CHAT_TAB_ID_PREFIX)) {
      const chatId = Number.parseInt(tabElement.id.slice(AI_CHAT_TAB_ID_PREFIX.length), 10);
      if (!Number.isNaN(chatId)) {
        const focusedIndex = openTabs.findIndex((tab) => tab.id === chatId);
        if (focusedIndex >= 0) {
          return focusedIndex;
        }
      }
    }
  }

  if (activeChatId == null) {
    return -1;
  }

  return openTabs.findIndex((tab) => tab.id === activeChatId);
}

/**
 * Tab bar for open AI chats.
 */
export function ChatTabBar(): JSX.Element {
  const dispatch = useAppDispatch();
  const chatHistory = useAppSelector(selectChatHistory);
  const openTabIds = useAppSelector(selectOpenChatTabIds);
  const activeChatId = useAppSelector(selectActiveChatId);
  const [activeDragChatId, setActiveDragChatId] = useState<number | null>(null);
  const sortableEnabled = openTabIds.length >= 2;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
   * Stable sortable ids for open AI chat tabs.
   */
  const sortableIds = useMemo(
    () => openTabIds.map((chatId) => aiChatTabSortableId(chatId)),
    [openTabIds]
  );

  /**
   * Chat currently being dragged for overlay preview.
   */
  const activeDragChat = useMemo(() => {
    if (activeDragChatId == null) {
      return null;
    }
    return openTabs.find((chat) => chat.id === activeDragChatId) ?? null;
  }, [activeDragChatId, openTabs]);

  /**
   * Records the chat tab being dragged for overlay preview.
   *
   * @param event - Drag start event from dnd-kit.
   */
  const handleDragStart = (event: DragStartEvent): void => {
    setActiveDragChatId(parseAiChatTabSortableId(String(event.active.id)));
  };

  /**
   * Persists a new chat tab order when a tab is dropped.
   *
   * @param event - Drag end event from dnd-kit.
   */
  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    setActiveDragChatId(null);
    if (!over || !sortableEnabled) {
      return;
    }

    const activeChatIdFromDrag = parseAiChatTabSortableId(String(active.id));
    const overChatId = parseAiChatTabSortableId(String(over.id));
    if (activeChatIdFromDrag == null || overChatId == null || activeChatIdFromDrag === overChatId) {
      return;
    }

    const oldIndex = openTabIds.indexOf(activeChatIdFromDrag);
    const newIndex = openTabIds.indexOf(overChatId);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    dispatch(reorderChatTabs(arrayMove(openTabIds, oldIndex, newIndex)));
  };

  /**
   * Moves focus and selection across open chat tabs with arrow, Home, and End keys.
   */
  const handleTabListKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const currentIndex = resolveFocusedChatTabIndex(openTabs, activeChatId);
    if (currentIndex < 0) return;

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
    <div className="relative z-10 flex shrink-0 items-end overflow-x-auto border-b border-separator bg-sidebar px-2 py-1 app-no-drag">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDragChatId(null)}
      >
        <div
          role="tablist"
          aria-label="Open AI chats"
          className="flex min-w-0 flex-1 items-end"
          onKeyDown={handleTabListKeyDown}
        >
          <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
            {openTabs.map((chat) => (
              <ChatTabItem
                key={chat.id}
                chat={chat}
                active={chat.id === activeChatId}
                tabIndex={0}
                sortableId={aiChatTabSortableId(chat.id)}
                sortableDisabled={!sortableEnabled}
                onSelect={(chatId) => dispatch(setActiveChat(chatId))}
                onClose={(chatId) => void dispatch(closeChat(chatId))}
              />
            ))}
          </SortableContext>
        </div>

        <DragOverlay>
          {activeDragChat ? (
            <div className="flex items-center gap-1.5 rounded-t-lg border border-separator bg-surface px-3 py-2 text-[14px] font-medium shadow-md">
              <FaIcon icon={faComment} className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {activeDragChat.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
