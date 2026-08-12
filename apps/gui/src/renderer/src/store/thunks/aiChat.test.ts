import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AI_CHAT_STREAM_EVENT_VERSION,
  type AddChatMessageInput,
  type ChatMessage,
  type ChatStepInput,
  type ChatStepResult,
  type ChatSummary
} from '@harborclient/core/types';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import aiChatReducer, {
  applyAiChatStreamEvent,
  recoverPendingTurn,
  resumeActiveTurn,
  setActiveStepRequestId,
  requestChatCancel
} from '#/renderer/src/store/slices/aiChatSlice';
import settingsReducer from '#/renderer/src/store/slices/settingsSlice';
import {
  confirmAgentTerminalCommand,
  resumeChatMessage,
  runActiveTurnLoop,
  sendChatMessage,
  type ActiveTurnLoopContext
} from './aiChat';
import { defaultGeneralSettings } from '#/renderer/src/store/slices/settingsSlice';

const runPluginAiBeforeTurnMock = vi.hoisted(() => vi.fn());
const showConfirmMock = vi.hoisted(() =>
  vi.fn<
    (
      dispatch: AppDispatch,
      options: {
        title: string;
        message: string;
        confirmLabel?: string;
        checkboxLabel?: string;
      }
    ) => Promise<{ confirmed: boolean; checkboxChecked: boolean }>
  >()
);

const setGeneralSettingsMock = vi.hoisted(() => vi.fn<(settings: unknown) => Promise<void>>());
const completeChatStepMock = vi.hoisted(() =>
  vi.fn<
    (
      input: ChatStepInput,
      streamContext: unknown,
      stepRequestId?: string
    ) => Promise<ChatStepResult>
  >()
);
const addChatMessageMock = vi.hoisted(() =>
  vi.fn<(input: AddChatMessageInput) => Promise<ChatMessage>>()
);
const listChatsMock = vi.hoisted(() => vi.fn<() => Promise<ChatSummary[]>>());
const savePendingChatTurnMock = vi.hoisted(() => vi.fn<() => Promise<void>>());
const deletePendingChatTurnMock = vi.hoisted(() => vi.fn<() => Promise<void>>());

vi.mock('#/renderer/src/plugins/pluginAiTurnBus', () => ({
  runPluginAiBeforeTurn: runPluginAiBeforeTurnMock,
  emitPluginAiAfterTurn: vi.fn()
}));

vi.mock('#/renderer/src/plugins/refineCustomPluginChatPointersAtSend', () => ({
  refineCustomPluginChatPointersAtSend: vi.fn(() => Promise.resolve())
}));

vi.mock('@harborclient/core/ai/scriptReferences', () => ({
  buildAiScriptSelectionContextMessage: vi.fn(() => null),
  collectChatReferenceSnapshots: vi.fn(() => null)
}));

vi.mock('#/renderer/src/ui/Sidebars/AiSidebar/Chat/useAiScriptReferenceValidationContext', () => ({
  buildAiScriptReferenceValidationContext: vi.fn(() => ({})),
  buildLiveServersByUuidFromState: vi.fn(() => ({})),
  buildSidebarItemNameMapsFromState: vi.fn(() => ({})),
  buildWebpageTabsByIdFromState: vi.fn(() => ({}))
}));

vi.mock('#/renderer/src/store/selectors', async (importOriginal) => ({
  ...(await importOriginal()),
  selectEffectiveActiveRequestTab: vi.fn(() => null),
  selectSnippets: vi.fn(() => [])
}));

vi.mock('#/renderer/src/store/slices/terminalsSlice', async (importOriginal) => ({
  ...(await importOriginal()),
  selectTerminalSelections: vi.fn(() => [])
}));
vi.mock('#/renderer/src/store/slices/liveServersSlice', async (importOriginal) => ({
  ...(await importOriginal()),
  selectLiveServerLogsSelections: vi.fn(() => [])
}));
vi.mock('#/renderer/src/store/slices/markdownSelectionsSlice', async (importOriginal) => ({
  ...(await importOriginal()),
  selectMarkdownSelections: vi.fn(() => [])
}));
vi.mock('#/renderer/src/store/slices/requestBodySelectionsSlice', async (importOriginal) => ({
  ...(await importOriginal()),
  selectRequestBodySelections: vi.fn(() => [])
}));
vi.mock('#/renderer/src/store/slices/responseSelectionsSlice', async (importOriginal) => ({
  ...(await importOriginal()),
  selectResponseSelections: vi.fn(() => [])
}));
vi.mock('#/renderer/src/store/slices/consoleSelectionsSlice', async (importOriginal) => ({
  ...(await importOriginal()),
  selectConsoleSelections: vi.fn(() => [])
}));
vi.mock('#/renderer/src/store/slices/scriptSelectionsSlice', async (importOriginal) => ({
  ...(await importOriginal()),
  selectScriptSelections: vi.fn(() => [])
}));
vi.mock('#/renderer/src/store/slices/pluginSelectionsSlice', async (importOriginal) => ({
  ...(await importOriginal()),
  selectPluginSelections: vi.fn(() => [])
}));

vi.mock('#/renderer/src/ui/Modals/dialogHelpers', () => ({
  showConfirm: showConfirmMock
}));

vi.stubGlobal('window', {
  api: {
    setGeneralSettings: setGeneralSettingsMock,
    completeChatStep: completeChatStepMock,
    addChatMessage: addChatMessageMock,
    listChats: listChatsMock,
    savePendingChatTurn: savePendingChatTurnMock,
    deletePendingChatTurn: deletePendingChatTurnMock,
    pushPluginAiAfterTurn: vi.fn()
  }
});

/**
 * Creates a promise whose resolution is controlled by the test.
 *
 * @returns Deferred promise and its resolver.
 */
function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

/**
 * Builds a minimal store for confirmAgentTerminalCommand tests.
 *
 * @param warnWhenAgentUsesTerminal - Whether the terminal confirmation prompt is enabled.
 */
function createTestStore(
  warnWhenAgentUsesTerminal: boolean
): ReturnType<typeof configureStore<{ settings: ReturnType<typeof settingsReducer> }>> {
  return configureStore({
    reducer: {
      settings: settingsReducer
    },
    preloadedState: {
      settings: {
        general: {
          ...defaultGeneralSettings,
          warnWhenAgentUsesTerminal
        }
      }
    }
  });
}

describe('confirmAgentTerminalCommand', () => {
  beforeEach(() => {
    showConfirmMock.mockReset();
    runPluginAiBeforeTurnMock.mockReset();
    setGeneralSettingsMock.mockReset();
    setGeneralSettingsMock.mockResolvedValue(undefined);
    completeChatStepMock.mockReset();
    addChatMessageMock.mockReset();
    listChatsMock.mockReset();
    listChatsMock.mockResolvedValue([]);
    savePendingChatTurnMock.mockReset();
    savePendingChatTurnMock.mockResolvedValue(undefined);
    deletePendingChatTurnMock.mockReset();
    deletePendingChatTurnMock.mockResolvedValue(undefined);
  });

  it('returns true without prompting when confirmations are suppressed', async () => {
    const store = createTestStore(false);
    const dispatch = store.dispatch as AppDispatch;

    const allowed = await confirmAgentTerminalCommand(
      JSON.stringify({ input: 'ls\n' }),
      store.getState as unknown as () => RootState,
      dispatch
    );

    expect(allowed).toBe(true);
    expect(showConfirmMock).not.toHaveBeenCalled();
  });

  it('returns true when the user allows the command', async () => {
    const store = createTestStore(true);
    const dispatch = store.dispatch as AppDispatch;
    showConfirmMock.mockResolvedValue({ confirmed: true, checkboxChecked: false });

    const allowed = await confirmAgentTerminalCommand(
      JSON.stringify({ input: 'ls\n' }),
      store.getState as unknown as () => RootState,
      dispatch
    );

    expect(allowed).toBe(true);
    expect(showConfirmMock).toHaveBeenCalledWith(
      dispatch,
      expect.objectContaining({
        title: 'Allow terminal command?',
        message: 'Agent is attempting to send commands to the terminal.\n\nls\n',
        confirmLabel: 'Allow',
        checkboxLabel: 'Do not show again'
      })
    );
    expect(setGeneralSettingsMock).not.toHaveBeenCalled();
  });

  it('persists suppression when the user checks do not show again', async () => {
    const store = createTestStore(true);
    const dispatch = store.dispatch as AppDispatch;
    showConfirmMock.mockResolvedValue({ confirmed: true, checkboxChecked: true });

    const allowed = await confirmAgentTerminalCommand(
      JSON.stringify({ input: 'pwd\n' }),
      store.getState as unknown as () => RootState,
      dispatch
    );

    expect(allowed).toBe(true);
    expect(setGeneralSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ warnWhenAgentUsesTerminal: false })
    );
    expect(store.getState().settings.general.warnWhenAgentUsesTerminal).toBe(false);
  });

  it('returns false when the user declines the command', async () => {
    const store = createTestStore(true);
    const dispatch = store.dispatch as AppDispatch;
    showConfirmMock.mockResolvedValue({ confirmed: false, checkboxChecked: false });

    const allowed = await confirmAgentTerminalCommand(
      JSON.stringify({ input: 'rm -rf /\n' }),
      store.getState as unknown as () => RootState,
      dispatch
    );

    expect(allowed).toBe(false);
    expect(setGeneralSettingsMock).not.toHaveBeenCalled();
  });
});

describe('runActiveTurnLoop', () => {
  it('pauses on the first valid ask_user call and resumes the same streamed turn', async () => {
    const store = configureStore({ reducer: { aiChat: aiChatReducer } });
    const dispatch = store.dispatch as unknown as AppDispatch;
    const getState = store.getState as unknown as () => RootState;
    const turnId = 'turn-ask-user';

    store.dispatch(
      applyAiChatStreamEvent({
        chatId: 7,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'turn.start',
          turnId,
          model: 'test-model'
        }
      })
    );
    completeChatStepMock
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          {
            id: 'ask-1',
            name: 'ask_user',
            arguments: JSON.stringify({
              question: 'Which environment?',
              choices: ['Staging', 'Production']
            })
          },
          {
            id: 'sibling-1',
            name: 'terminal_exec',
            arguments: JSON.stringify({ input: 'pwd\n' })
          }
        ]
      })
      .mockResolvedValueOnce({ content: 'Using Staging.', toolCalls: [] });
    addChatMessageMock.mockResolvedValue({
      id: 91,
      chatId: 7,
      role: 'assistant',
      content: 'Using Staging.',
      model: 'test-model',
      created_at: '2026-08-09T17:00:00.000Z'
    });

    const initialContext: ActiveTurnLoopContext = {
      chatId: 7,
      turnId,
      model: 'test-model',
      messages: [{ role: 'user', content: 'Configure it' }],
      userContent: 'Configure it',
      startedAt: Date.now(),
      stepCount: 0,
      toolCallCount: 0
    };
    const paused = await runActiveTurnLoop(initialContext, dispatch, getState);

    expect(paused.status).toBe('paused');
    expect(savePendingChatTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 7,
        turnId,
        toolCallId: 'ask-1',
        toolCallCount: 2
      })
    );
    expect(addChatMessageMock).not.toHaveBeenCalled();
    expect(store.getState().aiChat.sendingByChat[7]).toBeUndefined();
    expect(store.getState().aiChat.activeTurnByChat[7]?.pendingQuestion).toEqual({
      toolCallId: 'ask-1',
      question: 'Which environment?',
      choices: ['Staging', 'Production']
    });
    expect(initialContext.messages).toContainEqual({
      role: 'tool',
      tool_call_id: 'sibling-1',
      content: JSON.stringify({
        error: 'Skipped because another ask_user call paused the turn.'
      })
    });

    const resumedMessages = [
      ...initialContext.messages,
      { role: 'tool' as const, tool_call_id: 'ask-1', content: 'Staging' }
    ];
    store.dispatch(
      resumeActiveTurn({
        chatId: 7,
        turnId,
        messages: resumedMessages.map((message) => ({ ...message }))
      })
    );
    const completed = await runActiveTurnLoop(
      {
        ...initialContext,
        messages: resumedMessages,
        stepCount: paused.stepCount,
        toolCallCount: paused.toolCallCount
      },
      dispatch,
      getState
    );

    expect(completed.status).toBe('completed');
    expect(completeChatStepMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      { chatId: 7, turnId, stepIndex: 0 },
      expect.any(String)
    );
    expect(completeChatStepMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: 'tool', tool_call_id: 'ask-1', content: 'Staging' }
        ])
      }),
      { chatId: 7, turnId, stepIndex: 1 },
      expect.any(String)
    );
    expect(addChatMessageMock).toHaveBeenCalledTimes(1);
    expect(store.getState().aiChat.activeTurnByChat[7]).toBeUndefined();
    expect(store.getState().aiChat.messagesByChat[7]).toHaveLength(1);
    expect(store.getState().aiChat.revealingMessageIdByChat[7]).toBeUndefined();
  });
});

describe('resumeChatMessage', () => {
  /**
   * Creates a store holding a paused turn ready to receive an `ask_user` answer.
   *
   * @returns Store and dispatch helpers for resume orchestration tests.
   */
  function createPausedTurnStore(): {
    store: ReturnType<typeof configureStore<{ aiChat: ReturnType<typeof aiChatReducer> }>>;
    dispatch: AppDispatch;
  } {
    const store = configureStore({ reducer: { aiChat: aiChatReducer } });
    store.dispatch(
      recoverPendingTurn({
        v: 1,
        chatId: 7,
        turnId: 'paused-turn',
        model: 'test-model',
        messages: [{ role: 'user', content: 'Configure it' }],
        toolCallId: 'ask-1',
        question: 'Which environment?',
        rendererStepCount: 1,
        toolCallCount: 1,
        userContent: 'Configure it',
        updatedAt: '2026-08-09T17:00:00.000Z'
      })
    );
    return { store, dispatch: store.dispatch as unknown as AppDispatch };
  }

  it('claims the paused turn before deleting persistence and ignores a duplicate answer', async () => {
    const { store, dispatch } = createPausedTurnStore();
    const deleteDeferred = createDeferred<void>();
    const completeDeferred = createDeferred<ChatStepResult>();
    deletePendingChatTurnMock.mockReturnValueOnce(deleteDeferred.promise);
    completeChatStepMock.mockReturnValueOnce(completeDeferred.promise);

    const firstResume = dispatch(resumeChatMessage({ chatId: 7, answer: 'Staging' }));

    expect(store.getState().aiChat.activeTurnByChat[7]?.phase).toBe('streaming');
    expect(deletePendingChatTurnMock).toHaveBeenCalledTimes(1);

    const duplicateResume = dispatch(resumeChatMessage({ chatId: 7, answer: 'Production' }));
    await expect(duplicateResume).resolves.toMatchObject({ meta: { requestStatus: 'fulfilled' } });
    expect(deletePendingChatTurnMock).toHaveBeenCalledTimes(1);

    deleteDeferred.resolve(undefined);
    completeDeferred.resolve({ content: 'Using Staging.', toolCalls: [] });
    addChatMessageMock.mockResolvedValue({
      id: 92,
      chatId: 7,
      role: 'assistant',
      content: 'Using Staging.',
      model: 'test-model',
      created_at: '2026-08-09T17:00:00.000Z'
    });
    await expect(firstResume.unwrap()).resolves.toBeUndefined();
  });

  it('does not let an old terminal cleanup clear a newer turn runtime state', async () => {
    const { store, dispatch } = createPausedTurnStore();
    const finalDeleteDeferred = createDeferred<void>();
    completeChatStepMock.mockResolvedValueOnce({ content: 'Using Staging.', toolCalls: [] });
    addChatMessageMock.mockResolvedValue({
      id: 93,
      chatId: 7,
      role: 'assistant',
      content: 'Using Staging.',
      model: 'test-model',
      created_at: '2026-08-09T17:00:00.000Z'
    });
    deletePendingChatTurnMock
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(finalDeleteDeferred.promise);

    const oldResume = dispatch(resumeChatMessage({ chatId: 7, answer: 'Staging' }));
    await Promise.resolve();
    await Promise.resolve();

    store.dispatch(
      applyAiChatStreamEvent({
        chatId: 7,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'turn.start',
          turnId: 'new-turn',
          model: 'test-model'
        }
      })
    );
    store.dispatch(
      setActiveStepRequestId({ chatId: 7, stepRequestId: 'new-step', turnId: 'new-turn' })
    );
    store.dispatch(requestChatCancel(7));

    finalDeleteDeferred.resolve(undefined);
    await expect(oldResume.unwrap()).resolves.toBeUndefined();

    expect(store.getState().aiChat.activeTurnByChat[7]?.turnId).toBe('new-turn');
    expect(store.getState().aiChat.sendingByChat[7]).toBe(true);
    expect(store.getState().aiChat.activeStepRequestIdByChat[7]).toBe('new-step');
    expect(store.getState().aiChat.cancelRequestedByChat[7]).toBe(true);
  });
});

describe('sendChatMessage', () => {
  it('does not let an old terminal cleanup clear replacement preprocessing state', async () => {
    const store = configureStore({ reducer: { aiChat: aiChatReducer } });
    const dispatch = store.dispatch as unknown as AppDispatch;
    const finalDeleteDeferred = createDeferred<void>();
    const replacementBeforeTurn = createDeferred<{
      cancelled: boolean;
      extraInstructions: string[];
    }>();
    runPluginAiBeforeTurnMock.mockReset();
    completeChatStepMock.mockReset();
    addChatMessageMock.mockReset();
    deletePendingChatTurnMock.mockReset();
    listChatsMock.mockReset();
    listChatsMock.mockResolvedValue([]);
    runPluginAiBeforeTurnMock
      .mockResolvedValueOnce({ cancelled: false, extraInstructions: [] })
      .mockReturnValueOnce(replacementBeforeTurn.promise);
    completeChatStepMock.mockResolvedValueOnce({ content: 'First reply', toolCalls: [] });
    addChatMessageMock.mockImplementation(async (input) => ({
      id: input.role === 'user' ? 1 : 2,
      chatId: input.chatId,
      role: input.role,
      content: input.content,
      model: input.model,
      created_at: '2026-08-09T17:00:00.000Z'
    }));
    deletePendingChatTurnMock.mockReturnValueOnce(finalDeleteDeferred.promise);

    const oldTurn = dispatch(
      sendChatMessage({ chatId: 7, content: 'First message', model: 'test-model' })
    );
    await vi.waitFor(() => expect(deletePendingChatTurnMock).toHaveBeenCalledTimes(1));

    void dispatch(
      sendChatMessage({ chatId: 7, content: 'Replacement message', model: 'test-model' })
    );
    await vi.waitFor(() => expect(runPluginAiBeforeTurnMock).toHaveBeenCalledTimes(2));
    store.dispatch(requestChatCancel(7));

    expect(store.getState().aiChat.activeTurnByChat[7]).toBeUndefined();
    expect(store.getState().aiChat.sendingByChat[7]).toBe(true);

    finalDeleteDeferred.resolve(undefined);
    await expect(oldTurn.unwrap()).resolves.toBeUndefined();

    expect(store.getState().aiChat.sendingByChat[7]).toBe(true);
    expect(store.getState().aiChat.cancelRequestedByChat[7]).toBe(true);
    expect(store.getState().aiChat.activeTurnByChat[7]).toBeUndefined();
  });
});
