import type { ChatSummary } from '#/shared/types';

/** Stable key used to identify Today and Yesterday groups. */
export const CHAT_HISTORY_TODAY_KEY = 'today';
export const CHAT_HISTORY_YESTERDAY_KEY = 'yesterday';

/** Maximum chats shown per day section before a section-level Show more control. */
export const CHAT_HISTORY_SECTION_ITEM_LIMIT = 12;

/**
 * Chats grouped under a day label for the history dropdown.
 */
export interface ChatHistoryGroup {
  /**
   * Stable group key for React rendering.
   */
  key: string;

  /**
   * User-facing section heading.
   */
  label: string;

  /**
   * Chats in this day group, preserving input order.
   */
  chats: ChatSummary[];
}

/**
 * Returns midnight local time for a date.
 *
 * @param date - Calendar date to normalize.
 */
function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Resolves the day bucket key and label for a chat timestamp.
 *
 * @param updatedAt - ISO timestamp from chat persistence.
 * @param now - Reference time for Today/Yesterday comparison.
 */
function resolveDayBucket(updatedAt: string, now: Date): { key: string; label: string } {
  const chatDate = new Date(updatedAt);
  const dayDiff = Math.round((startOfLocalDay(now) - startOfLocalDay(chatDate)) / 86_400_000);

  if (dayDiff === 0) {
    return { key: CHAT_HISTORY_TODAY_KEY, label: 'Today' };
  }

  if (dayDiff === 1) {
    return { key: CHAT_HISTORY_YESTERDAY_KEY, label: 'Yesterday' };
  }

  const label = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(chatDate);

  const key = `day-${chatDate.getFullYear()}-${chatDate.getMonth() + 1}-${chatDate.getDate()}`;
  return { key, label };
}

/**
 * Filters chat summaries by a case-insensitive title substring.
 *
 * @param chats - Full chat history list.
 * @param query - User search text; empty returns all chats.
 */
export function filterChats(chats: ChatSummary[], query: string): ChatSummary[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return chats;
  }

  const needle = trimmed.toLowerCase();
  return chats.filter((chat) => chat.title.toLowerCase().includes(needle));
}

/**
 * Excludes chats that have no persisted messages from history lists.
 *
 * @param chats - Chat summaries from persistence.
 */
export function filterChatsWithMessages(chats: ChatSummary[]): ChatSummary[] {
  return chats.filter((chat) => chat.message_count > 0);
}

/**
 * Groups chats by calendar day while preserving the incoming list order.
 *
 * @param chats - Filtered chat summaries, typically newest-first.
 * @param now - Reference time for Today/Yesterday labels.
 */
export function groupChatsByDay(chats: ChatSummary[], now: Date): ChatHistoryGroup[] {
  const groups: ChatHistoryGroup[] = [];
  const groupIndexByKey = new Map<string, number>();

  for (const chat of chats) {
    const { key, label } = resolveDayBucket(chat.updated_at, now);
    const existingIndex = groupIndexByKey.get(key);

    if (existingIndex == null) {
      groupIndexByKey.set(key, groups.length);
      groups.push({ key, label, chats: [chat] });
      continue;
    }

    groups[existingIndex]?.chats.push(chat);
  }

  return groups;
}

/**
 * Splits day groups into recent (Today/Yesterday) and older sections.
 *
 * @param groups - Ordered day groups from {@link groupChatsByDay}.
 */
export function splitRecentAndOlder(groups: ChatHistoryGroup[]): {
  recent: ChatHistoryGroup[];
  older: ChatHistoryGroup[];
} {
  const recent: ChatHistoryGroup[] = [];
  const older: ChatHistoryGroup[] = [];

  for (const group of groups) {
    if (group.key === CHAT_HISTORY_TODAY_KEY || group.key === CHAT_HISTORY_YESTERDAY_KEY) {
      recent.push(group);
    } else {
      older.push(group);
    }
  }

  return { recent, older };
}

/**
 * Returns whether any day group is Today or Yesterday.
 *
 * @param groups - Ordered day groups from {@link groupChatsByDay}.
 */
export function hasRecentDayGroups(groups: ChatHistoryGroup[]): boolean {
  return groups.some(
    (group) => group.key === CHAT_HISTORY_TODAY_KEY || group.key === CHAT_HISTORY_YESTERDAY_KEY
  );
}

/**
 * Truncates a day group's chats to the section item limit unless expanded.
 *
 * @param group - Day group to render.
 * @param isExpanded - Whether the user has expanded this section.
 * @returns Visible group and whether more chats remain hidden.
 */
export function truncateGroupChats(
  group: ChatHistoryGroup,
  isExpanded: boolean
): { group: ChatHistoryGroup; hasMore: boolean } {
  if (isExpanded || group.chats.length <= CHAT_HISTORY_SECTION_ITEM_LIMIT) {
    return { group, hasMore: false };
  }

  return {
    group: {
      ...group,
      chats: group.chats.slice(0, CHAT_HISTORY_SECTION_ITEM_LIMIT)
    },
    hasMore: true
  };
}

/**
 * Truncates a flat chat list when no Today/Yesterday sections are shown.
 *
 * @param chats - Filtered chat summaries, typically newest-first.
 * @param showAll - Whether the user has expanded the flat list.
 * @returns Visible chats and whether more chats remain hidden.
 */
export function truncateFlatChats(
  chats: ChatSummary[],
  showAll: boolean
): { chats: ChatSummary[]; hasMore: boolean } {
  if (showAll || chats.length <= CHAT_HISTORY_SECTION_ITEM_LIMIT) {
    return { chats, hasMore: false };
  }

  return {
    chats: chats.slice(0, CHAT_HISTORY_SECTION_ITEM_LIMIT),
    hasMore: true
  };
}
