import { describe, expect, it } from 'vitest';
import type { ChatSummary } from '#/shared/types';
import {
  CHAT_HISTORY_TODAY_KEY,
  CHAT_HISTORY_YESTERDAY_KEY,
  filterChats,
  groupChatsByDay,
  splitRecentAndOlder
} from '#/renderer/src/ui/AiSidebar/Chat/chatHistoryGrouping';

const NOW = new Date('2026-07-03T15:00:00');

/**
 * Builds a minimal chat summary for grouping tests.
 *
 * @param id - Chat id.
 * @param title - Display title.
 * @param updatedAt - ISO updated timestamp.
 */
function chat(id: number, title: string, updatedAt: string): ChatSummary {
  return { id, title, updated_at: updatedAt };
}

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
