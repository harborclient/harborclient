import { describe, expect, it } from 'vitest';
import { chatIdsWithMessages } from './tabContextMenuHelpers';

describe('chatIdsWithMessages', () => {
  it('keeps chats that have messages and excludes empty chats', () => {
    const messagesByChat = {
      1: [{ id: 1 }],
      2: [],
      3: [{ id: 2 }, { id: 3 }]
    };

    expect(chatIdsWithMessages([1, 2, 3], messagesByChat)).toEqual([1, 3]);
  });

  it('treats missing message lists as empty chats', () => {
    expect(chatIdsWithMessages([4, 5], {})).toEqual([]);
  });
});
