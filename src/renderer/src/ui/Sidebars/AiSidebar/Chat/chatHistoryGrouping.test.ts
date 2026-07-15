import { describe, expect, it } from 'vitest';
import type { ChatSummary } from '#/shared/types';
import {
  CHAT_HISTORY_SECTION_ITEM_LIMIT,
  CHAT_HISTORY_TODAY_KEY,
  CHAT_HISTORY_YESTERDAY_KEY,
  filterChats,
  filterChatsWithMessages,
  groupChatsByDay,
  hasRecentDayGroups,
  splitRecentAndOlder,
  truncateFlatChats,
  truncateGroupChats
} from '#/renderer/src/ui/Sidebars/AiSidebar/Chat/chatHistoryGrouping';

const NOW = new Date('2026-07-03T15:00:00');

/**
 * Builds a minimal chat summary for grouping tests.
 *
 * @param id - Chat id.
 * @param title - Display title.
 * @param updatedAt - ISO updated timestamp.
 * @param messageCount - Persisted message count for history filtering tests.
 */
function chat(id: number, title: string, updatedAt: string, messageCount = 1): ChatSummary {
  return { id, title, updated_at: updatedAt, message_count: messageCount };
}

describe('filterChatsWithMessages', () => {
  it('keeps chats with messages and excludes empty chats', () => {
    const chats = [
      chat(1, 'Saved chat', '2026-07-03T10:00:00', 2),
      chat(2, 'Empty chat', '2026-07-02T10:00:00', 0)
    ];

    expect(filterChatsWithMessages(chats)).toEqual([chats[0]]);
  });
});

describe('filterChats', () => {
  const chats = [
    chat(1, 'Deploy API', '2026-07-03T10:00:00'),
    chat(2, 'Fix auth bug', '2026-07-02T10:00:00')
  ];

  it('returns all chats when the query is empty', () => {
    expect(filterChats(chats, '')).toEqual(chats);
    expect(filterChats(chats, '   ')).toEqual(chats);
  });

  it('matches titles case-insensitively', () => {
    expect(filterChats(chats, 'deploy')).toEqual([chats[0]]);
    expect(filterChats(chats, 'AUTH')).toEqual([chats[1]]);
  });
});

describe('groupChatsByDay', () => {
  it('groups chats into Today, Yesterday, and older day labels', () => {
    const chats = [
      chat(1, 'Today one', '2026-07-03T09:00:00'),
      chat(2, 'Today two', '2026-07-03T08:00:00'),
      chat(3, 'Yesterday one', '2026-07-02T18:00:00'),
      chat(4, 'Older one', '2026-06-30T12:00:00')
    ];

    const groups = groupChatsByDay(chats, NOW);

    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({
      key: CHAT_HISTORY_TODAY_KEY,
      label: 'Today',
      chats: [chats[0], chats[1]]
    });
    expect(groups[1]).toMatchObject({
      key: CHAT_HISTORY_YESTERDAY_KEY,
      label: 'Yesterday',
      chats: [chats[2]]
    });
    expect(groups[2]?.key).toMatch(/^day-/);
    expect(groups[2]?.chats).toEqual([chats[3]]);
  });
});

describe('splitRecentAndOlder', () => {
  it('separates Today/Yesterday from older day groups', () => {
    const groups = groupChatsByDay(
      [
        chat(1, 'Today', '2026-07-03T09:00:00'),
        chat(2, 'Yesterday', '2026-07-02T09:00:00'),
        chat(3, 'Older', '2026-06-01T09:00:00')
      ],
      NOW
    );

    const { recent, older } = splitRecentAndOlder(groups);

    expect(recent).toHaveLength(2);
    expect(recent.map((group) => group.key)).toEqual([
      CHAT_HISTORY_TODAY_KEY,
      CHAT_HISTORY_YESTERDAY_KEY
    ]);
    expect(older).toHaveLength(1);
    expect(older[0]?.chats).toHaveLength(1);
  });
});

describe('hasRecentDayGroups', () => {
  it('returns true when Today or Yesterday groups exist', () => {
    const groups = groupChatsByDay(
      [chat(1, 'Today', '2026-07-03T09:00:00'), chat(2, 'Yesterday', '2026-07-02T09:00:00')],
      NOW
    );

    expect(hasRecentDayGroups(groups)).toBe(true);
  });

  it('returns false when only older day groups exist', () => {
    const groups = groupChatsByDay([chat(1, 'Older', '2026-06-01T09:00:00')], NOW);

    expect(hasRecentDayGroups(groups)).toBe(false);
  });
});

describe('truncateGroupChats', () => {
  const largeGroup = {
    key: CHAT_HISTORY_TODAY_KEY,
    label: 'Today',
    chats: Array.from({ length: CHAT_HISTORY_SECTION_ITEM_LIMIT + 3 }, (_, index) =>
      chat(index + 1, `Chat ${index + 1}`, '2026-07-03T09:00:00')
    )
  };

  it('returns the full group when at or below the section limit', () => {
    const smallGroup = {
      key: CHAT_HISTORY_TODAY_KEY,
      label: 'Today',
      chats: largeGroup.chats.slice(0, CHAT_HISTORY_SECTION_ITEM_LIMIT)
    };

    expect(truncateGroupChats(smallGroup, false)).toEqual({
      group: smallGroup,
      hasMore: false
    });
  });

  it('truncates to the section limit when collapsed', () => {
    const result = truncateGroupChats(largeGroup, false);

    expect(result.hasMore).toBe(true);
    expect(result.group.chats).toHaveLength(CHAT_HISTORY_SECTION_ITEM_LIMIT);
    expect(result.group.chats).toEqual(largeGroup.chats.slice(0, CHAT_HISTORY_SECTION_ITEM_LIMIT));
  });

  it('returns the full group when expanded', () => {
    expect(truncateGroupChats(largeGroup, true)).toEqual({
      group: largeGroup,
      hasMore: false
    });
  });
});

describe('truncateFlatChats', () => {
  const chats = Array.from({ length: CHAT_HISTORY_SECTION_ITEM_LIMIT + 2 }, (_, index) =>
    chat(index + 1, `Chat ${index + 1}`, '2026-06-01T09:00:00')
  );

  it('returns all chats when at or below the section limit', () => {
    const smallChats = chats.slice(0, CHAT_HISTORY_SECTION_ITEM_LIMIT);

    expect(truncateFlatChats(smallChats, false)).toEqual({
      chats: smallChats,
      hasMore: false
    });
  });

  it('truncates to the section limit when collapsed', () => {
    const result = truncateFlatChats(chats, false);

    expect(result.hasMore).toBe(true);
    expect(result.chats).toHaveLength(CHAT_HISTORY_SECTION_ITEM_LIMIT);
    expect(result.chats).toEqual(chats.slice(0, CHAT_HISTORY_SECTION_ITEM_LIMIT));
  });

  it('returns all chats when expanded', () => {
    expect(truncateFlatChats(chats, true)).toEqual({
      chats,
      hasMore: false
    });
  });
});
