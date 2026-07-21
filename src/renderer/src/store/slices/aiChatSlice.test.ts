import { describe, expect, it } from 'vitest';
import aiChatReducer, {
  appendMessage,
  clearChatCancelState,
  clearComposerFocus,
  closeChatTab,
  openChatTab,
  reorderChatTabs,
  requestChatCancel,
  requestComposerFocus,
  restoreChatSession,
  setActiveChat,
  setActiveStepRequestId,
  setChats,
  setEnterToSend
} from './aiChatSlice';

describe('aiChatSlice', () => {
  it('stores chat history summaries', () => {
    const state = aiChatReducer(
      undefined,
      setChats([
        { id: 1, title: 'First chat', updated_at: '2024-01-01T00:00:00.000Z', message_count: 1 }
      ])
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

  it('reorders open chat tabs without changing the active chat', () => {
    let state = aiChatReducer(undefined, openChatTab(1));
    state = aiChatReducer(state, openChatTab(2));
    state = aiChatReducer(state, openChatTab(3));

    state = aiChatReducer(state, reorderChatTabs([3, 1, 2]));

    expect(state.openTabIds).toEqual([3, 1, 2]);
    expect(state.activeChatId).toBe(3);
  });

  it('ignores invalid chat tab reorder payloads', () => {
    let state = aiChatReducer(undefined, openChatTab(1));
    state = aiChatReducer(state, openChatTab(2));

    state = aiChatReducer(state, reorderChatTabs([2]));
    expect(state.openTabIds).toEqual([1, 2]);

    state = aiChatReducer(state, reorderChatTabs([2, 99]));
    expect(state.openTabIds).toEqual([1, 2]);
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

  it('tracks active step request ids and cancellation flags', () => {
    let state = aiChatReducer(
      undefined,
      setActiveStepRequestId({ chatId: 2, stepRequestId: 'step-1' })
    );
    expect(state.activeStepRequestIdByChat[2]).toBe('step-1');

    state = aiChatReducer(state, requestChatCancel(2));
    expect(state.cancelRequestedByChat[2]).toBe(true);

    state = aiChatReducer(state, clearChatCancelState(2));
    expect(state.activeStepRequestIdByChat[2]).toBeUndefined();
    expect(state.cancelRequestedByChat[2]).toBeUndefined();
  });

  it('defaults enterToSend to true and updates via setEnterToSend', () => {
    expect(aiChatReducer(undefined, { type: 'unknown' }).enterToSend).toBe(true);

    const state = aiChatReducer(undefined, setEnterToSend(false));
    expect(state.enterToSend).toBe(false);
  });

  it('defaults pendingComposerFocusChatId to null and toggles via request/clear', () => {
    expect(aiChatReducer(undefined, { type: 'unknown' }).pendingComposerFocusChatId).toBeNull();

    let state = aiChatReducer(undefined, requestComposerFocus(42));
    expect(state.pendingComposerFocusChatId).toBe(42);

    state = aiChatReducer(state, clearComposerFocus());
    expect(state.pendingComposerFocusChatId).toBeNull();
  });
});
