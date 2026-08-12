import { createAsyncThunk } from '@reduxjs/toolkit';
import { DEFAULT_CHAT_TITLE } from '@harborclient/core/ai/chatTitle';
import { getAvailableModels, resolveAiModelOption } from '@harborclient/core/ai/models';
import {
  buildAiScriptSelectionContextMessage,
  collectChatReferenceSnapshots
} from '@harborclient/core/ai/scriptReferences';
import {
  AI_AGENT_MAX_RENDERER_STEP_ITERATIONS,
  AI_CHAT_STREAM_EVENT_VERSION,
  AI_CHAT_STREAM_TOOL_RESULT_SUMMARY_MAX_LENGTH
} from '@harborclient/core/types';
import {
  PENDING_AI_CHAT_TURN_VERSION,
  type PendingAiChatTurn
} from '@harborclient/core/types/aiChatStream';
import type {
  AiSettings,
  ChatMessage,
  ChatStepMessage,
  ChatSummary,
  ChatToolCall
} from '@harborclient/core/types';
import { executeAiToolCall } from '#/renderer/src/store/ai/aiToolExecutor';
import type { AppDispatch, RootState, ThunkApiConfig } from '#/renderer/src/store/redux';
import { patchGeneralSettings } from './settings';
import { showConfirm } from '#/renderer/src/ui/Modals/dialogHelpers';
import {
  buildAiScriptReferenceValidationContext,
  buildLiveServersByUuidFromState,
  buildSidebarItemNameMapsFromState,
  buildWebpageTabsByIdFromState
} from '#/renderer/src/ui/Sidebars/AiSidebar/Chat/useAiScriptReferenceValidationContext';
import { selectEffectiveActiveRequestTab, selectSnippets } from '#/renderer/src/store/selectors';
import { selectTerminalSelections } from '#/renderer/src/store/slices/terminalsSlice';
import { selectLiveServerLogsSelections } from '#/renderer/src/store/slices/liveServersSlice';
import { selectMarkdownSelections } from '#/renderer/src/store/slices/markdownSelectionsSlice';
import { selectRequestBodySelections } from '#/renderer/src/store/slices/requestBodySelectionsSlice';
import { selectResponseSelections } from '#/renderer/src/store/slices/responseSelectionsSlice';
import { selectConsoleSelections } from '#/renderer/src/store/slices/consoleSelectionsSlice';
import { selectScriptSelections } from '#/renderer/src/store/slices/scriptSelectionsSlice';
import { selectPluginSelections } from '#/renderer/src/store/slices/pluginSelectionsSlice';
import { refineCustomPluginChatPointersAtSend } from '#/renderer/src/plugins/refineCustomPluginChatPointersAtSend';
import {
  emitPluginAiAfterTurn,
  runPluginAiBeforeTurn
} from '#/renderer/src/plugins/pluginAiTurnBus';
import { rehydrateChatReferenceSnapshots } from './rehydrateChatReferenceSnapshots';
import {
  appendMessage,
  applyAiChatStreamEvent,
  clearChatCancelState,
  clearSendError,
  closeChatTab,
  openChatTab,
  requestChatCancel,
  setActiveChat,
  setActiveStepRequestId,
  setChats,
  setMessages,
  setSelectedModel,
  restoreChatSession,
  setHubModelGroups,
  setGithubModelsStatus,
  setSendError,
  setSending,
  storeActiveTurnContext,
  recoverPendingTurn,
  startMessageReveal,
  resumeActiveTurn,
  setEnterToSend,
  requestComposerFocus,
  invalidateActiveTurn,
  claimTurnLifecycle,
  releaseTurnLifecycle
} from '#/renderer/src/store/slices/aiChatSlice';

/**
 * Prompts the user before the AI agent sends input to the active footer terminal.
 *
 * @param rawArgs - Raw JSON tool arguments from the model.
 * @param getState - Reads the current Redux root state.
 * @param dispatch - Redux dispatch for modal and settings updates.
 * @returns True when the user allowed the command or confirmations are suppressed.
 */
export async function confirmAgentTerminalCommand(
  rawArgs: string,
  getState: () => RootState,
  dispatch: AppDispatch
): Promise<boolean> {
  if (!getState().settings.general.warnWhenAgentUsesTerminal) {
    return true;
  }

  let input = '';
  try {
    input = String((JSON.parse(rawArgs) as { input?: unknown })?.input ?? '');
  } catch {
    input = '';
  }

  const result = await showConfirm(dispatch, {
    title: 'Allow terminal command?',
    message: `Agent is attempting to send commands to the terminal.${input ? `\n\n${input}` : ''}`,
    confirmLabel: 'Allow',
    variant: 'danger',
    checkboxLabel: 'Do not show again'
  });

  if (result.confirmed && result.checkboxChecked) {
    await dispatch(patchGeneralSettings({ warnWhenAgentUsesTerminal: false }));
  }

  return result.confirmed;
}

/**
 * Returns whether a chat send was cancelled by the user.
 *
 * @param error - Error thrown while awaiting a chat step.
 * @param state - Current Redux state.
 * @param chatId - Chat id being sent to.
 */
function isUserChatCancellation(error: unknown, state: RootState, chatId: number): boolean {
  if (state.aiChat.cancelRequestedByChat[chatId]) {
    return true;
  }
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

/**
 * Returns whether a turn still owns a chat's mutable lifecycle state.
 *
 * @param state - Current Redux state.
 * @param chatId - Chat whose owner is being checked.
 * @param turnId - Turn attempting terminal cleanup.
 * @returns True when terminal cleanup may mutate the chat's lifecycle state.
 */
function ownsTurnLifecycle(state: RootState, chatId: number, turnId: string): boolean {
  return state.aiChat.lifecycleTurnIdByChat[chatId] === turnId;
}

/**
 * Maps persisted chat messages to LLM step messages.
 *
 * @param messages - Messages stored for a chat thread.
 */
function historyToStepMessages(messages: ChatMessage[]): ChatStepMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content
  }));
}

/**
 * Validated question data from an `ask_user` call.
 */
interface AskUserQuestion {
  question: string;
  choices?: string[];
}

/**
 * Mutable protocol context shared by initial and resumed renderer loops.
 */
export interface ActiveTurnLoopContext {
  chatId: number;
  turnId: string;
  model: string;
  hubId?: string;
  messages: ChatStepMessage[];
  userContent: string;
  startedAt: number;
  stepCount: number;
  toolCallCount: number;
}

/**
 * Result of running a renderer-owned turn until pause or terminal completion.
 */
export interface ActiveTurnLoopResult {
  status: 'completed' | 'cancelled' | 'paused';
  assistantText: string | null;
  stepCount: number;
  toolCallCount: number;
}

/**
 * Parses and validates one `ask_user` call without executing it as an ordinary tool.
 *
 * @param rawArgs - Provider-emitted JSON arguments.
 * @returns Normalized question data or a deterministic validation error.
 */
function parseAskUserQuestion(rawArgs: string): AskUserQuestion | { error: string } {
  let value: unknown;
  try {
    value = rawArgs.trim() ? (JSON.parse(rawArgs) as unknown) : {};
  } catch {
    return { error: 'Invalid ask_user arguments JSON.' };
  }
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'ask_user arguments must be an object.' };
  }

  const record = value as Record<string, unknown>;
  const question = typeof record.question === 'string' ? record.question.trim() : '';
  if (!question) {
    return { error: 'ask_user requires a non-empty question.' };
  }
  if (record.choices === undefined) {
    return { question };
  }
  if (
    !Array.isArray(record.choices) ||
    record.choices.length === 0 ||
    record.choices.some((choice) => typeof choice !== 'string' || choice.trim().length === 0)
  ) {
    return { error: 'ask_user choices must be a non-empty array of non-empty strings.' };
  }
  return {
    question,
    choices: record.choices.map((choice) => (choice as string).trim())
  };
}

/**
 * Removes non-whitespace ASCII control characters from UI-facing tool output.
 *
 * @param value - Full tool result text.
 * @returns Text safe to place in the live progress presentation.
 */
function removeUnsafeResultControls(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('');
}

/**
 * Produces a bounded, control-character-safe result summary for live tool progress.
 *
 * @param result - Full model-facing tool result.
 * @returns UI-safe summary and inferred success flag.
 */
function summarizeToolResult(result: string): { summary: string; ok: boolean } {
  const normalized = removeUnsafeResultControls(result).trim();
  let ok = true;
  try {
    const parsed = JSON.parse(result) as unknown;
    ok = !(
      parsed != null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof (parsed as Record<string, unknown>).error === 'string'
    );
  } catch {
    // Plain-text tool output is a successful result unless execution supplied an error object.
  }
  const summary =
    normalized.length > AI_CHAT_STREAM_TOOL_RESULT_SUMMARY_MAX_LENGTH
      ? `${normalized.slice(0, AI_CHAT_STREAM_TOOL_RESULT_SUMMARY_MAX_LENGTH - 1)}…`
      : normalized;
  return { summary, ok };
}

/**
 * Returns the persisted assistant reply used when the renderer-owned outer
 * loop reaches its independent step cap.
 *
 * @returns A user-actionable continuation message.
 */
function outerIterationLimitContent(): string {
  return 'I reached the desktop tool-step limit before completing the request. Please ask me to continue.';
}

/**
 * Appends and presents one renderer-owned tool result while retaining its full model payload.
 *
 * @param context - Active turn protocol context.
 * @param call - Tool call receiving the result.
 * @param result - Full JSON/text result sent back to the model.
 * @param dispatch - Redux dispatch used for live presentation.
 */
function appendDesktopToolResult(
  context: ActiveTurnLoopContext,
  call: ChatToolCall,
  result: string,
  dispatch: AppDispatch
): void {
  context.messages.push({
    role: 'tool',
    tool_call_id: call.id,
    content: result
  });
  context.toolCallCount += 1;
  const { summary, ok } = summarizeToolResult(result);
  dispatch(
    applyAiChatStreamEvent({
      chatId: context.chatId,
      event: {
        v: AI_CHAT_STREAM_EVENT_VERSION,
        type: 'tool.result',
        turnId: context.turnId,
        stepIndex: Math.max(0, context.stepCount - 1),
        callId: call.id,
        name: call.name,
        owner: 'renderer',
        summary,
        ok
      }
    })
  );
}

/**
 * Runs provider steps and desktop tools until the turn completes, pauses, or is cancelled.
 *
 * @param context - Existing protocol snapshot and counters.
 * @param dispatch - Redux dispatch for state and tool actions.
 * @param getState - Reads cancellation and app state.
 * @returns Loop outcome with terminal text and updated counters.
 */
export async function runActiveTurnLoop(
  context: ActiveTurnLoopContext,
  dispatch: AppDispatch,
  getState: () => RootState
): Promise<ActiveTurnLoopResult> {
  let assistantText: string | null = null;

  while (context.stepCount < AI_AGENT_MAX_RENDERER_STEP_ITERATIONS) {
    if (getState().aiChat.cancelRequestedByChat[context.chatId]) {
      return {
        status: 'cancelled',
        assistantText,
        stepCount: context.stepCount,
        toolCallCount: context.toolCallCount
      };
    }

    const stepIndex = context.stepCount;
    const stepRequestId = crypto.randomUUID();
    dispatch(
      setActiveStepRequestId({
        chatId: context.chatId,
        stepRequestId,
        turnId: context.turnId
      })
    );

    let step;
    try {
      step = await window.api.completeChatStep(
        {
          model: context.model,
          messages: context.messages,
          ...(context.hubId ? { hubId: context.hubId } : {})
        },
        {
          chatId: context.chatId,
          turnId: context.turnId,
          stepIndex
        },
        stepRequestId
      );
      context.stepCount += 1;
    } finally {
      dispatch(
        setActiveStepRequestId({
          chatId: context.chatId,
          stepRequestId: null,
          turnId: context.turnId
        })
      );
    }

    if (getState().aiChat.cancelRequestedByChat[context.chatId]) {
      return {
        status: 'cancelled',
        assistantText,
        stepCount: context.stepCount,
        toolCallCount: context.toolCallCount
      };
    }

    const calls = step.toolCalls ?? [];
    if (calls.length === 0) {
      assistantText = step.content;
      break;
    }

    context.messages.push({
      role: 'assistant',
      content: step.content,
      tool_calls: calls
    });

    const validPause = calls
      .map((call) => ({
        call,
        parsed: call.name === 'ask_user' ? parseAskUserQuestion(call.arguments) : null
      }))
      .find(
        (candidate): candidate is { call: ChatToolCall; parsed: AskUserQuestion } =>
          candidate.parsed != null && !('error' in candidate.parsed)
      );

    if (validPause != null) {
      const skippedResult = JSON.stringify({
        error: 'Skipped because another ask_user call paused the turn.'
      });
      for (const call of calls) {
        if (call.id === validPause.call.id) {
          context.toolCallCount += 1;
          continue;
        }
        appendDesktopToolResult(context, call, skippedResult, dispatch);
      }

      dispatch(
        storeActiveTurnContext({
          chatId: context.chatId,
          turnId: context.turnId,
          messages: context.messages,
          userContent: context.userContent,
          startedAt: context.startedAt,
          stepCount: context.stepCount,
          toolCallCount: context.toolCallCount
        })
      );
      const pendingTurn: PendingAiChatTurn = {
        v: PENDING_AI_CHAT_TURN_VERSION,
        chatId: context.chatId,
        turnId: context.turnId,
        model: context.model,
        ...(context.hubId ? { hubId: context.hubId } : {}),
        messages: context.messages,
        toolCallId: validPause.call.id,
        question: validPause.parsed.question,
        ...(validPause.parsed.choices != null ? { choices: validPause.parsed.choices } : {}),
        rendererStepCount: context.stepCount,
        toolCallCount: context.toolCallCount,
        userContent: context.userContent,
        updatedAt: new Date().toISOString()
      };
      await window.api.savePendingChatTurn(pendingTurn);
      dispatch(
        applyAiChatStreamEvent({
          chatId: context.chatId,
          event: {
            v: AI_CHAT_STREAM_EVENT_VERSION,
            type: 'turn.awaiting_user',
            turnId: context.turnId,
            toolCallId: validPause.call.id,
            question: validPause.parsed.question,
            ...(validPause.parsed.choices != null ? { choices: validPause.parsed.choices } : {})
          }
        })
      );
      return {
        status: 'paused',
        assistantText: null,
        stepCount: context.stepCount,
        toolCallCount: context.toolCallCount
      };
    }

    for (const call of calls) {
      if (getState().aiChat.cancelRequestedByChat[context.chatId]) {
        return {
          status: 'cancelled',
          assistantText,
          stepCount: context.stepCount,
          toolCallCount: context.toolCallCount
        };
      }

      let result: string;
      if (call.name === 'ask_user') {
        const parsed = parseAskUserQuestion(call.arguments);
        result = JSON.stringify(
          'error' in parsed ? parsed : { error: 'ask_user could not pause this turn.' }
        );
      } else if (call.name === 'terminal_exec') {
        const allowed = await confirmAgentTerminalCommand(call.arguments, getState, dispatch);
        if (getState().aiChat.cancelRequestedByChat[context.chatId]) {
          return {
            status: 'cancelled',
            assistantText,
            stepCount: context.stepCount,
            toolCallCount: context.toolCallCount
          };
        }
        result = allowed
          ? await executeAiToolCall(call.name, call.arguments, { getState, dispatch })
          : JSON.stringify({ error: 'User declined to allow the terminal command.' });
      } else {
        result = await executeAiToolCall(call.name, call.arguments, { getState, dispatch });
      }
      appendDesktopToolResult(context, call, result, dispatch);
    }
  }

  if (assistantText == null || assistantText.trim() === '') {
    assistantText =
      context.stepCount >= AI_AGENT_MAX_RENDERER_STEP_ITERATIONS
        ? outerIterationLimitContent()
        : 'I could not complete your request.';
  }
  const hitOuterIterationLimit =
    context.stepCount >= AI_AGENT_MAX_RENDERER_STEP_ITERATIONS &&
    assistantText === outerIterationLimitContent();

  const assistantMessage = await window.api.addChatMessage({
    chatId: context.chatId,
    role: 'assistant',
    content: assistantText,
    model: context.model
  });
  dispatch(
    applyAiChatStreamEvent({
      chatId: context.chatId,
      event: {
        v: AI_CHAT_STREAM_EVENT_VERSION,
        type: 'turn.end',
        turnId: context.turnId,
        content: assistantText,
        ...(hitOuterIterationLimit
          ? { iteration: { hitIterationLimit: true, boundary: 'renderer_outer' as const } }
          : {})
      }
    })
  );
  dispatch(appendMessage(assistantMessage));
  dispatch(startMessageReveal({ chatId: context.chatId, messageId: assistantMessage.id }));
  await dispatch(refreshChatHistory());

  return {
    status: 'completed',
    assistantText,
    stepCount: context.stepCount,
    toolCallCount: context.toolCallCount
  };
}

/**
 * Emits the exactly-once terminal plugin notification for a renderer-owned turn.
 *
 * @param context - Turn routing and retained plugin context.
 * @param result - Terminal status, assistant content, counters, and optional error.
 */
function emitTerminalAfterTurn(
  context: ActiveTurnLoopContext,
  result: {
    status: 'completed' | 'cancelled' | 'error';
    assistantText: string | null;
    stepCount: number;
    toolCallCount: number;
    error?: string;
  }
): void {
  emitPluginAiAfterTurn({
    chatId: context.chatId,
    model: context.model,
    ...(context.hubId ? { hubId: context.hubId } : {}),
    userMessage: { content: context.userContent },
    assistantMessage: result.assistantText != null ? { content: result.assistantText } : null,
    status: result.status,
    ...(result.error != null ? { error: { message: result.error } } : {}),
    stats: {
      stepCount: result.stepCount,
      toolCallCount: result.toolCallCount,
      durationMs: Date.now() - context.startedAt
    }
  });
}

/**
 * Restores a valid paused turn into waiting UI without invoking a model.
 *
 * @param chatId - Chat id whose durable recovery state should be loaded.
 * @param dispatch - Redux dispatch used to install recovered state.
 */
async function hydratePendingChatTurn(chatId: number, dispatch: AppDispatch): Promise<void> {
  const pendingTurn = await window.api.getPendingChatTurn(chatId);
  if (pendingTurn != null) {
    dispatch(recoverPendingTurn(pendingTurn));
  }
}

/**
 * Refreshes chat history from persistence.
 */
export const refreshChatHistory = createAsyncThunk<ChatSummary[], void, ThunkApiConfig>(
  'aiChat/refreshHistory',
  async (_, { dispatch }) => {
    const summaries = await window.api.listChats();
    dispatch(setChats(summaries));
    return summaries;
  }
);

/**
 * Generates a short AI title for a chat from the user's first message.
 */
export const generateChatTitle = createAsyncThunk<
  string | null,
  { chatId: number; prompt: string; model: string; hubId?: string },
  ThunkApiConfig
>('aiChat/generateTitle', async (input, { dispatch, getState }) => {
  const chatSummary = getState().aiChat.chats.find((chat) => chat.id === input.chatId);
  if (chatSummary?.title !== DEFAULT_CHAT_TITLE) {
    return null;
  }

  try {
    const title = await window.api.generateChatTitle(input);
    if (title !== DEFAULT_CHAT_TITLE) {
      await dispatch(refreshChatHistory());
      return title;
    }
  } catch {
    // Keep the default title when summarization fails.
  }

  return null;
});

/**
 * Loads a chat's messages into state and opens it as a tab.
 *
 * @param chatId - Chat id to load.
 */
export const loadChat = createAsyncThunk<number, number, ThunkApiConfig>(
  'aiChat/loadChat',
  async (chatId, { dispatch, getState }) => {
    const chat = await window.api.getChat(chatId);
    if (!chat) {
      throw new Error('Chat not found');
    }

    dispatch(setMessages({ chatId, messages: chat.messages }));
    rehydrateChatReferenceSnapshots(chat.messages, dispatch, getState);
    dispatch(clearSendError(chatId));
    if (chat.model) {
      dispatch(setSelectedModel({ chatId, modelId: chat.model }));
    }
    await hydratePendingChatTurn(chatId, dispatch as AppDispatch);
    dispatch(openChatTab(chatId));
    return chatId;
  }
);

/**
 * Refreshes Team Hub LLM models available to the chat composer and sidebar.
 */
export const refreshHubLlmModels = createAsyncThunk<void, void, ThunkApiConfig>(
  'aiChat/refreshHubLlmModels',
  async (_, { dispatch }) => {
    const [hubModelGroups, githubModelsStatus] = await Promise.all([
      window.api.listHubLlmModels(),
      window.api.getGithubModelsStatus()
    ]);
    dispatch(setHubModelGroups(hubModelGroups));
    dispatch(setGithubModelsStatus(githubModelsStatus));
  }
);

/**
 * Updates the Enter-to-send composer preference in Redux and on disk.
 *
 * Merges into the persisted session so open chat tabs are not wiped when the
 * preference is changed from Settings while the AI sidebar is closed.
 *
 * @param enterToSend - Whether plain Enter should send the chat message.
 */
export const updateEnterToSend = createAsyncThunk<void, boolean, ThunkApiConfig>(
  'aiChat/updateEnterToSend',
  async (enterToSend, { dispatch }) => {
    dispatch(setEnterToSend(enterToSend));
    const session = await window.api.getAiChatSession();
    await window.api.setAiChatSession({ ...session, enterToSend });
  }
);

/**
 * Initializes AI chat state when the sidebar opens.
 */
export const initializeAiChat = createAsyncThunk<void, AiSettings, ThunkApiConfig>(
  'aiChat/initialize',
  async (aiSettings, { dispatch, getState }) => {
    const { openTabIds, activeChatId } = getState().aiChat;
    const session = await window.api.getAiChatSession();
    dispatch(setEnterToSend(session.enterToSend));

    await dispatch(refreshHubLlmModels()).unwrap();
    const { hubModelGroups, githubModelsStatus } = getState().aiChat;

    if (openTabIds.length > 0 && activeChatId != null) {
      return;
    }

    const summaries = await dispatch(refreshChatHistory()).unwrap();
    const availableModels = getAvailableModels(
      aiSettings,
      hubModelGroups,
      githubModelsStatus.connected
    );
    const defaultModel = availableModels[0]?.value;
    const existingChatIds = new Set(summaries.map((chat) => chat.id));
    const validOpenTabIds = session.openTabIds.filter((id) => existingChatIds.has(id));
    const validActiveChatId =
      session.activeChatId != null && validOpenTabIds.includes(session.activeChatId)
        ? session.activeChatId
        : (validOpenTabIds[0] ?? null);

    if (validOpenTabIds.length > 0 && validActiveChatId != null) {
      dispatch(
        restoreChatSession({
          openTabIds: validOpenTabIds,
          activeChatId: validActiveChatId
        })
      );

      await Promise.all(
        validOpenTabIds.map(async (chatId) => {
          const chat = await window.api.getChat(chatId);
          if (!chat) return;
          dispatch(setMessages({ chatId, messages: chat.messages }));
          rehydrateChatReferenceSnapshots(chat.messages, dispatch, getState);
          dispatch(clearSendError(chatId));
          if (chat.model) {
            dispatch(setSelectedModel({ chatId, modelId: chat.model }));
          }
          await hydratePendingChatTurn(chatId, dispatch as AppDispatch);
        })
      );
      return;
    }

    let chatId: number;
    if (summaries.length === 0) {
      const created = await window.api.createChat(defaultModel ? { model: defaultModel } : {});
      chatId = created.id;
      await dispatch(refreshChatHistory());
    } else {
      chatId = summaries[0].id;
    }

    if (getState().aiChat.openTabIds.length === 0) {
      await dispatch(loadChat(chatId));
      if (defaultModel) {
        dispatch(setSelectedModel({ chatId, modelId: defaultModel }));
      }
      // User opened the sidebar with no session tabs — focus the composer so they can type.
      // Restoring persisted open tabs above intentionally skips this.
      dispatch(requestComposerFocus(chatId));
    }
  }
);

/**
 * Creates a new chat tab and selects it.
 */
export const createNewChat = createAsyncThunk<void, AiSettings, ThunkApiConfig>(
  'aiChat/createNewChat',
  async (aiSettings, { dispatch, getState }) => {
    const { hubModelGroups, githubModelsStatus } = getState().aiChat;
    const availableModels = getAvailableModels(
      aiSettings,
      hubModelGroups,
      githubModelsStatus.connected
    );
    const defaultModel = availableModels[0]?.value;
    const activeChatId = getState().aiChat.activeChatId;
    const selectedModel =
      (activeChatId != null ? getState().aiChat.selectedModelByChat[activeChatId] : undefined) ??
      defaultModel;

    const created = await window.api.createChat(selectedModel ? { model: selectedModel } : {});
    dispatch(setMessages({ chatId: created.id, messages: [] }));
    if (selectedModel) {
      dispatch(setSelectedModel({ chatId: created.id, modelId: selectedModel }));
    }
    dispatch(openChatTab(created.id));
    dispatch(requestComposerFocus(created.id));
    await dispatch(refreshChatHistory());
  }
);

/**
 * Creates a new chat tab and immediately sends the first user message.
 */
export const startNewChatWithPrompt = createAsyncThunk<
  void,
  { aiSettings: AiSettings; prompt: string },
  ThunkApiConfig
>('aiChat/startNewChatWithPrompt', async ({ aiSettings, prompt }, { dispatch, getState }) => {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return;
  }

  await dispatch(createNewChat(aiSettings));

  const chatId = getState().aiChat.activeChatId;
  if (chatId == null) {
    return;
  }

  const modelId = getState().aiChat.selectedModelByChat[chatId];
  if (!modelId) {
    return;
  }

  const { hubModelGroups, githubModelsStatus } = getState().aiChat;
  const modelOption = resolveAiModelOption(
    modelId,
    aiSettings,
    hubModelGroups,
    githubModelsStatus.connected
  );

  await dispatch(
    sendChatMessage({
      chatId,
      content: trimmed,
      model: modelOption?.id ?? modelId,
      hubId: modelOption?.source === 'hub' ? modelOption.hubId : undefined
    })
  );
});

/**
 * Opens an existing chat from history.
 *
 * @param chatId - Chat id to open.
 */
export const openExistingChat = createAsyncThunk<void, number, ThunkApiConfig>(
  'aiChat/openExistingChat',
  async (chatId, { dispatch }) => {
    await dispatch(loadChat(chatId));
  }
);

/**
 * Closes a chat tab in the current session.
 *
 * @param chatId - Chat id to close.
 */
export const closeChat = createAsyncThunk<void, number, ThunkApiConfig>(
  'aiChat/closeChat',
  async (chatId, { dispatch }) => {
    dispatch(closeChatTab(chatId));
  }
);

/**
 * Sends a user message and requests an assistant reply from the LLM.
 */
export const sendChatMessage = createAsyncThunk<
  void,
  { chatId: number; content: string; model?: string; hubId?: string },
  ThunkApiConfig
>('aiChat/sendMessage', async ({ chatId, content, model, hubId }, { dispatch, getState }) => {
  const trimmed = content.trim();
  if (!trimmed) return;

  const modelId = model?.trim();
  if (!modelId) {
    dispatch(setSendError({ chatId, message: 'Select a model before sending.' }));
    return;
  }

  dispatch(clearSendError(chatId));

  await refineCustomPluginChatPointersAtSend(trimmed);

  const validationContext = buildAiScriptReferenceValidationContext(
    selectEffectiveActiveRequestTab(getState()),
    selectSnippets(getState()),
    selectTerminalSelections(getState()),
    selectMarkdownSelections(getState()),
    buildSidebarItemNameMapsFromState(getState()),
    selectRequestBodySelections(getState()),
    selectScriptSelections(getState()),
    selectResponseSelections(getState()),
    selectPluginSelections(getState()),
    buildWebpageTabsByIdFromState(getState()),
    buildLiveServersByUuidFromState(getState()),
    selectLiveServerLogsSelections(getState()),
    selectConsoleSelections(getState())
  );
  const referenceSnapshots = collectChatReferenceSnapshots(trimmed, validationContext);

  const userMessage = await window.api.addChatMessage({
    chatId,
    role: 'user',
    content: trimmed,
    model: modelId,
    ...(referenceSnapshots != null ? { referenceSnapshots } : {})
  });
  dispatch(appendMessage(userMessage));
  if (referenceSnapshots != null) {
    rehydrateChatReferenceSnapshots([userMessage], dispatch, getState);
  }

  const chatSummary = getState().aiChat.chats.find((chat) => chat.id === chatId);
  const userMessages = (getState().aiChat.messagesByChat[chatId] ?? []).filter(
    (message) => message.role === 'user'
  );
  if (userMessages.length === 1 && chatSummary?.title === DEFAULT_CHAT_TITLE) {
    void dispatch(
      generateChatTitle({
        chatId,
        prompt: trimmed,
        model: modelId,
        ...(hubId ? { hubId } : {})
      })
    );
  }

  const turnStartedAt = Date.now();
  let modelFacingUserContent = trimmed;
  const turnId = crypto.randomUUID();
  dispatch(claimTurnLifecycle({ chatId, turnId }));
  dispatch(setSending({ chatId, sending: true, turnId }));
  let loopContext: ActiveTurnLoopContext | null = null;
  let loopResult: ActiveTurnLoopResult | null = null;
  let terminalStatus: 'completed' | 'cancelled' | 'error' | null = null;
  let terminalError: string | undefined;

  try {
    dispatch(clearChatCancelState({ chatId, turnId }));
    const messages = historyToStepMessages(getState().aiChat.messagesByChat[chatId] ?? []);
    const selectionContext = buildAiScriptSelectionContextMessage(trimmed, validationContext);
    if (selectionContext != null) {
      messages.push({ role: 'system', content: selectionContext });
    }

    const beforeTurn = await runPluginAiBeforeTurn({
      chatId,
      model: modelId,
      ...(hubId ? { hubId } : {}),
      userMessage: {
        content: trimmed,
        ...(referenceSnapshots != null ? { referenceSnapshots } : {})
      },
      messages: messages.map((row) => ({
        role: row.role,
        content: row.content ?? null
      }))
    });

    if (beforeTurn.cancelled) {
      terminalStatus = 'cancelled';
      if (beforeTurn.cancelReason) {
        dispatch(setSendError({ chatId, message: beforeTurn.cancelReason }));
      }
      return;
    }
    if (getState().aiChat.cancelRequestedByChat[chatId]) {
      terminalStatus = 'cancelled';
      return;
    }

    if (beforeTurn.userContent != null && beforeTurn.userContent !== trimmed) {
      modelFacingUserContent = beforeTurn.userContent;
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i]?.role === 'user') {
          messages[i] = { ...messages[i]!, content: modelFacingUserContent };
          break;
        }
      }
    }

    if (beforeTurn.extraInstructions.length > 0) {
      messages.push({
        role: 'system',
        content: `Plugin turn instructions:\n${beforeTurn.extraInstructions.join('\n')}`
      });
    }

    loopContext = {
      chatId,
      turnId,
      model: modelId,
      ...(hubId ? { hubId } : {}),
      messages,
      userContent: modelFacingUserContent,
      startedAt: turnStartedAt,
      stepCount: 0,
      toolCallCount: 0
    };
    dispatch(
      applyAiChatStreamEvent({
        chatId,
        event: {
          v: AI_CHAT_STREAM_EVENT_VERSION,
          type: 'turn.start',
          turnId,
          model: modelId,
          ...(hubId ? { hubId } : {})
        }
      })
    );
    loopResult = await runActiveTurnLoop(loopContext, dispatch as AppDispatch, getState);
    if (loopResult.status === 'paused') {
      return;
    }
    terminalStatus = loopResult.status;
  } catch (error) {
    if (isUserChatCancellation(error, getState(), chatId)) {
      terminalStatus = 'cancelled';
      return;
    }
    terminalStatus = 'error';
    const message =
      error instanceof Error ? error.message : 'Failed to get a response from the model.';
    terminalError = message;
    dispatch(setSendError({ chatId, message }));
  } finally {
    if (terminalStatus != null) {
      if (ownsTurnLifecycle(getState(), chatId, turnId)) {
        await window.api.deletePendingChatTurn(chatId);
      }
      if (loopContext != null && terminalStatus !== 'completed') {
        dispatch(
          applyAiChatStreamEvent({
            chatId,
            event:
              terminalStatus === 'cancelled'
                ? {
                    v: AI_CHAT_STREAM_EVENT_VERSION,
                    type: 'turn.cancelled',
                    turnId
                  }
                : {
                    v: AI_CHAT_STREAM_EVENT_VERSION,
                    type: 'turn.error',
                    turnId,
                    message: terminalError ?? 'Failed to get a response from the model.'
                  }
          })
        );
      }
      emitTerminalAfterTurn(
        loopContext ?? {
          chatId,
          turnId,
          model: modelId,
          ...(hubId ? { hubId } : {}),
          messages: [],
          userContent: modelFacingUserContent,
          startedAt: turnStartedAt,
          stepCount: 0,
          toolCallCount: 0
        },
        {
          status: terminalStatus,
          assistantText: loopResult?.assistantText ?? null,
          stepCount: loopResult?.stepCount ?? loopContext?.stepCount ?? 0,
          toolCallCount: loopResult?.toolCallCount ?? loopContext?.toolCallCount ?? 0,
          ...(terminalError != null ? { error: terminalError } : {})
        }
      );
      dispatch(setSending({ chatId, sending: false, turnId }));
    }
    dispatch(clearChatCancelState({ chatId, turnId }));
    if (terminalStatus != null) {
      dispatch(releaseTurnLifecycle({ chatId, turnId }));
    }
  }
});

/**
 * Resumes a paused `ask_user` call by supplying the answer as its tool result.
 */
export const resumeChatMessage = createAsyncThunk<
  void,
  { chatId: number; answer: string },
  ThunkApiConfig
>('aiChat/resumeMessage', async ({ chatId, answer }, { dispatch, getState }) => {
  const trimmed = answer.trim();
  const state = getState();
  const active = state.aiChat.activeTurnByChat[chatId];
  const activeModel = active?.model ?? state.aiChat.selectedModelByChat[chatId];
  if (
    !trimmed ||
    !activeModel ||
    active == null ||
    active.phase !== 'awaiting_user' ||
    active.pendingQuestion == null
  ) {
    return;
  }

  const messages: ChatStepMessage[] = [
    ...active.stepMessages,
    {
      role: 'tool',
      tool_call_id: active.pendingQuestion.toolCallId,
      content: trimmed
    }
  ];
  const context: ActiveTurnLoopContext = {
    chatId,
    turnId: active.turnId,
    model: activeModel,
    ...(active.hubId ? { hubId: active.hubId } : {}),
    messages,
    userContent: active.userContent ?? '',
    startedAt: active.startedAt ?? Date.now(),
    stepCount: active.stepCount ?? 0,
    toolCallCount: active.toolCallCount ?? 0
  };

  dispatch(
    resumeActiveTurn({
      chatId,
      turnId: active.turnId,
      messages: messages.map((message) => ({ ...message }))
    })
  );
  dispatch(clearSendError(chatId));
  dispatch(clearChatCancelState({ chatId, turnId: active.turnId }));
  await window.api.deletePendingChatTurn(chatId);

  let loopResult: ActiveTurnLoopResult | null = null;
  let terminalStatus: 'completed' | 'cancelled' | 'error' | null = null;
  let terminalError: string | undefined;
  try {
    loopResult = await runActiveTurnLoop(context, dispatch as AppDispatch, getState);
    if (loopResult.status === 'paused') {
      return;
    }
    terminalStatus = loopResult.status;
  } catch (error) {
    terminalStatus = isUserChatCancellation(error, getState(), chatId) ? 'cancelled' : 'error';
    if (terminalStatus === 'error') {
      terminalError =
        error instanceof Error ? error.message : 'Failed to resume the response from the model.';
      dispatch(setSendError({ chatId, message: terminalError }));
    }
  } finally {
    if (terminalStatus != null) {
      if (ownsTurnLifecycle(getState(), chatId, context.turnId)) {
        await window.api.deletePendingChatTurn(chatId);
      }
      if (terminalStatus !== 'completed') {
        dispatch(
          applyAiChatStreamEvent({
            chatId,
            event:
              terminalStatus === 'cancelled'
                ? {
                    v: AI_CHAT_STREAM_EVENT_VERSION,
                    type: 'turn.cancelled',
                    turnId: context.turnId
                  }
                : {
                    v: AI_CHAT_STREAM_EVENT_VERSION,
                    type: 'turn.error',
                    turnId: context.turnId,
                    message: terminalError ?? 'Failed to resume the response from the model.'
                  }
          })
        );
      }
      emitTerminalAfterTurn(context, {
        status: terminalStatus,
        assistantText: loopResult?.assistantText ?? null,
        stepCount: loopResult?.stepCount ?? context.stepCount,
        toolCallCount: loopResult?.toolCallCount ?? context.toolCallCount,
        ...(terminalError != null ? { error: terminalError } : {})
      });
      dispatch(setSending({ chatId, sending: false, turnId: context.turnId }));
    }
    dispatch(clearChatCancelState({ chatId, turnId: context.turnId }));
    if (terminalStatus != null) {
      dispatch(releaseTurnLifecycle({ chatId, turnId: context.turnId }));
    }
  }
});

/**
 * Cancels the in-flight AI reply for a chat tab.
 */
export const cancelChatMessage = createAsyncThunk<void, number, ThunkApiConfig>(
  'aiChat/cancelMessage',
  async (chatId, { dispatch, getState }) => {
    const active = getState().aiChat.activeTurnByChat[chatId];
    if (active?.phase === 'awaiting_user') {
      const activeModel =
        active.model ?? getState().aiChat.selectedModelByChat[chatId] ?? 'unknown';
      const stepCount = active.stepCount ?? 0;
      const toolCallCount = active.toolCallCount ?? 0;
      await window.api.deletePendingChatTurn(chatId);
      dispatch(
        applyAiChatStreamEvent({
          chatId,
          event: {
            v: AI_CHAT_STREAM_EVENT_VERSION,
            type: 'turn.cancelled',
            turnId: active.turnId
          }
        })
      );
      emitTerminalAfterTurn(
        {
          chatId,
          turnId: active.turnId,
          model: activeModel,
          ...(active.hubId ? { hubId: active.hubId } : {}),
          messages: active.stepMessages,
          userContent: active.userContent ?? '',
          startedAt: active.startedAt ?? Date.now(),
          stepCount,
          toolCallCount
        },
        {
          status: 'cancelled',
          assistantText: null,
          stepCount,
          toolCallCount
        }
      );
      dispatch(clearChatCancelState(chatId));
      dispatch(releaseTurnLifecycle({ chatId, turnId: active.turnId }));
      return;
    }

    if (!getState().aiChat.sendingByChat[chatId]) {
      return;
    }

    dispatch(requestChatCancel(chatId));

    const stepRequestId = getState().aiChat.activeStepRequestIdByChat[chatId];
    dispatch(invalidateActiveTurn(chatId));
    await window.api.deletePendingChatTurn(chatId);
    if (stepRequestId) {
      await window.api.cancelChatStep(stepRequestId);
    }
  }
);

/**
 * Deletes a chat from persistence and closes its tab.
 *
 * @param chatId - Chat id to delete.
 */
export const deleteChatThunk = createAsyncThunk<void, number, ThunkApiConfig>(
  'aiChat/deleteChat',
  async (chatId, { dispatch, getState }) => {
    await window.api.deleteChat(chatId);
    dispatch(closeChatTab(chatId));

    const remainingTabs = getState().aiChat.openTabIds.filter((id) => id !== chatId);
    if (remainingTabs.length === 0) {
      const summaries = await dispatch(refreshChatHistory()).unwrap();
      if (summaries.length > 0) {
        await dispatch(loadChat(summaries[0].id));
      } else {
        dispatch(setActiveChat(null));
      }
    }

    await dispatch(refreshChatHistory());
  }
);
