import { describe, expect, it } from 'vitest';
import aiChatReducer, {
  appendMessage,
  closeChatTab,
  openChatTab,
  restoreChatSession,
  setActiveChat,
  setChats
} from '#/renderer/src/store/slices/aiChatSlice';

describe('aiChatSlice', () => {
  it('stores chat history summaries', () => {
    const state = aiChatReducer(
      undefined,
      setChats([{ id: 1, title: 'First chat', updated_at: '2024-01-01T00:00:00.000Z' }])
    );
    expect(state.chats).toHaveLength(1);
    expect(state.chats[0]?.title).toBe('First chat');
  });

  it('opens and activates chat tabs', () => {
    let state = aiChatReducer(undefined, openChatTab(3));
    expect(state.openTabIds).toEqual([3]);
    expect(state.activeChatId).toBe(3);

    state = aiChatReducer(state, setActiveChat(5));
    expect(state.activeChatId).toBe(5);
  });

  it('closes a tab and selects a neighbor', () => {
    let state = aiChatReducer(undefined, openChatTab(1));
    state = aiChatReducer(state, openChatTab(2));
    state = aiChatReducer(state, setActiveChat(2));

    state = aiChatReducer(state, closeChatTab(2));
    expect(state.openTabIds).toEqual([1]);
    expect(state.activeChatId).toBe(1);
  });

  it('restores persisted chat session tabs', () => {
    const state = aiChatReducer(
      undefined,
      restoreChatSession({ openTabIds: [2, 5], activeChatId: 5 })
    );
    expect(state.openTabIds).toEqual([2, 5]);
    expect(state.activeChatId).toBe(5);
  });

  it('appends messages for a chat', () => {
    const state = aiChatReducer(
      undefined,
      appendMessage({
        id: 10,
        chatId: 4,
        role: 'user',
        content: 'Hello',
        created_at: '2024-01-01T00:00:00.000Z'
      })
    );
    expect(state.messagesByChat[4]).toHaveLength(1);
    expect(state.messagesByChat[4]?.[0]?.content).toBe('Hello');
  });
});
