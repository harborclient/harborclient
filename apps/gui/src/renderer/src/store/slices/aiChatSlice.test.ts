import { describe, expect, it } from 'vitest';
import { AI_CHAT_STREAM_EVENT_VERSION } from '@harborclient/core/types';
import aiChatReducer, {
  applyAiChatStreamEvent,
  appendMessage,
  clearActiveTurn,
  invalidateActiveTurn,
  clearChatCancelState,
  clearComposerFocus,
  clearMessageReveal,
  closeChatTab,
  openChatTab,
  reorderChatTabs,
  requestChatCancel,
  requestComposerFocus,
  restoreChatSession,
  setActiveChat,
  setActiveStepRequestId,
  setChats,
  setEnterToSend,
  setMessages,
  startMessageReveal
} from './aiChatSlice';

const TURN_ID = 'turn-abc-123';

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

  it('tracks typewriter reveal message ids and clears them', () => {
    let state = aiChatReducer(undefined, startMessageReveal({ chatId: 4, messageId: 99 }));
    expect(state.revealingMessageIdByChat[4]).toBe(99);

    state = aiChatReducer(state, clearMessageReveal(4));
    expect(state.revealingMessageIdByChat[4]).toBeUndefined();
  });

  it('clears typewriter reveal when messages are replaced from persistence', () => {
    let state = aiChatReducer(undefined, startMessageReveal({ chatId: 4, messageId: 99 }));
    state = aiChatReducer(state, setMessages({ chatId: 4, messages: [] }));
    expect(state.revealingMessageIdByChat[4]).toBeUndefined();
  });

  it('clears typewriter reveal when switching away from a chat', () => {
    let state = aiChatReducer(undefined, openChatTab(1));
    state = aiChatReducer(state, startMessageReveal({ chatId: 1, messageId: 10 }));
    state = aiChatReducer(state, setActiveChat(2));
    expect(state.revealingMessageIdByChat[1]).toBeUndefined();
  });

  it('clears typewriter reveal when closing a chat tab', () => {
    let state = aiChatReducer(undefined, openChatTab(1));
    state = aiChatReducer(state, startMessageReveal({ chatId: 1, messageId: 10 }));
    state = aiChatReducer(state, closeChatTab(1));
    expect(state.revealingMessageIdByChat[1]).toBeUndefined();
  });

  it('applies stream events to the matching active turn and ignores stale turn ids', () => {
    let state = aiChatReducer(
      undefined,
      applyAiChatStreamEvent({
        chatId: 4,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'turn.start',
          turnId: TURN_ID,
          model: 'gpt-4o'
        }
      })
    );

    expect(state.activeTurnByChat[4]?.turnId).toBe(TURN_ID);
    expect(state.sendingByChat[4]).toBe(true);

    state = aiChatReducer(
      state,
      applyAiChatStreamEvent({
        chatId: 4,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'delta.text',
          turnId: TURN_ID,
          stepIndex: 0,
          chunk: 'Hello'
        }
      })
    );

    expect(state.activeTurnByChat[4]?.text).toBe('Hello');

    state = aiChatReducer(
      state,
      applyAiChatStreamEvent({
        chatId: 4,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'delta.text',
          turnId: 'other-turn',
          stepIndex: 0,
          chunk: ' stale'
        }
      })
    );

    expect(state.activeTurnByChat[4]?.text).toBe('Hello');
  });

  it('clears sending while retaining active state during awaiting_user', () => {
    let state = aiChatReducer(
      undefined,
      applyAiChatStreamEvent({
        chatId: 2,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'turn.start',
          turnId: TURN_ID,
          model: 'gpt-4o'
        }
      })
    );

    state = aiChatReducer(
      state,
      applyAiChatStreamEvent({
        chatId: 2,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'turn.awaiting_user',
          turnId: TURN_ID,
          toolCallId: 'call-1',
          question: 'Continue?'
        }
      })
    );

    expect(state.activeTurnByChat[2]?.phase).toBe('awaiting_user');
    expect(state.activeTurnByChat[2]?.pendingQuestion?.question).toBe('Continue?');
    expect(state.sendingByChat[2]).toBeUndefined();
  });

  it('tracks tool rows and clears active turns on terminal events', () => {
    let state = aiChatReducer(
      undefined,
      applyAiChatStreamEvent({
        chatId: 1,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'turn.start',
          turnId: TURN_ID,
          model: 'gpt-4o'
        }
      })
    );

    state = aiChatReducer(
      state,
      applyAiChatStreamEvent({
        chatId: 1,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'tool.call',
          turnId: TURN_ID,
          stepIndex: 0,
          callId: 'call-1',
          name: 'search',
          owner: 'harbor',
          arguments: '{}'
        }
      })
    );

    expect(state.activeTurnByChat[1]?.toolRows).toEqual([
      {
        callId: 'call-1',
        name: 'search',
        owner: 'harbor',
        status: 'running'
      }
    ]);
    expect(state.sendingByChat[1]).toBe(true);

    state = aiChatReducer(
      state,
      applyAiChatStreamEvent({
        chatId: 1,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'turn.end',
          turnId: TURN_ID
        }
      })
    );

    expect(state.activeTurnByChat[1]).toBeUndefined();
    expect(state.sendingByChat[1]).toBeUndefined();
  });

  it('clears active turns explicitly and ignores events for other chats', () => {
    let state = aiChatReducer(
      undefined,
      applyAiChatStreamEvent({
        chatId: 1,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'turn.start',
          turnId: TURN_ID,
          model: 'gpt-4o'
        }
      })
    );

    state = aiChatReducer(state, clearActiveTurn(1));
    expect(state.activeTurnByChat[1]).toBeUndefined();

    state = aiChatReducer(
      state,
      applyAiChatStreamEvent({
        chatId: 2,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'delta.text',
          turnId: TURN_ID,
          stepIndex: 0,
          chunk: 'Wrong chat'
        }
      })
    );

    expect(state.activeTurnByChat[2]).toBeUndefined();
  });

  it('invalidates a cancelled turn before late stream events arrive', () => {
    let state = aiChatReducer(
      undefined,
      applyAiChatStreamEvent({
        chatId: 1,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'turn.start',
          turnId: TURN_ID,
          model: 'gpt-4o'
        }
      })
    );
    state = aiChatReducer(state, setActiveStepRequestId({ chatId: 1, stepRequestId: 'step-1' }));

    state = aiChatReducer(state, invalidateActiveTurn(1));
    state = aiChatReducer(
      state,
      applyAiChatStreamEvent({
        chatId: 1,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'delta.text',
          turnId: TURN_ID,
          stepIndex: 0,
          chunk: 'Late text'
        }
      })
    );

    expect(state.activeTurnByChat[1]).toBeUndefined();
    expect(state.sendingByChat[1]).toBeUndefined();
    expect(state.activeStepRequestIdByChat[1]).toBeUndefined();
  });

  it('stashes handoff markdown on turn.end and skips typewriter reveal after persistence', () => {
    let state = aiChatReducer(
      undefined,
      applyAiChatStreamEvent({
        chatId: 7,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'turn.start',
          turnId: TURN_ID,
          model: 'gpt-4o'
        }
      })
    );

    state = aiChatReducer(
      state,
      applyAiChatStreamEvent({
        chatId: 7,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'delta.text',
          turnId: TURN_ID,
          stepIndex: 0,
          chunk: 'Streamed reply'
        }
      })
    );

    state = aiChatReducer(
      state,
      applyAiChatStreamEvent({
        chatId: 7,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'turn.end',
          turnId: TURN_ID
        }
      })
    );

    expect(state.activeTurnByChat[7]).toBeUndefined();
    expect(state.handoffPresentationByChat[7]?.text).toBe('Streamed reply');

    state = aiChatReducer(
      state,
      appendMessage({
        id: 50,
        chatId: 7,
        role: 'assistant',
        content: 'Streamed reply',
        created_at: '2024-01-01T00:00:00.000Z'
      })
    );

    expect(state.handoffPresentationByChat[7]).toBeUndefined();
    expect(state.skipRevealMessageIdByChat[7]).toBe(50);

    state = aiChatReducer(state, startMessageReveal({ chatId: 7, messageId: 50 }));
    expect(state.revealingMessageIdByChat[7]).toBeUndefined();
    expect(state.skipRevealMessageIdByChat[7]).toBeUndefined();
  });

  it('clears handoff presentation on turn cancellation', () => {
    let state = aiChatReducer(
      undefined,
      applyAiChatStreamEvent({
        chatId: 8,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'turn.start',
          turnId: TURN_ID,
          model: 'gpt-4o'
        }
      })
    );

    state = aiChatReducer(
      state,
      applyAiChatStreamEvent({
        chatId: 8,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'delta.text',
          turnId: TURN_ID,
          stepIndex: 0,
          chunk: 'Partial'
        }
      })
    );

    state = aiChatReducer(
      state,
      applyAiChatStreamEvent({
        chatId: 8,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'turn.cancelled',
          turnId: TURN_ID
        }
      })
    );

    expect(state.handoffPresentationByChat[8]).toBeUndefined();
    expect(state.activeTurnByChat[8]).toBeUndefined();
  });
});
