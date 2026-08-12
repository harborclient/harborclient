import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  AiChatStreamRendererMessage,
  AiChatStreamToolOwner,
  ChatMessage,
  ChatStepMessage,
  ChatSummary,
  GithubModelsStatus,
  HubLlmModelGroup
} from '@harborclient/core/types';
import type { RootState } from '#/renderer/src/store/redux';
import type { PendingAiChatTurn } from '@harborclient/core/types/aiChatStream';

/**
 * Lifecycle phase for an in-memory active AI chat turn.
 */
export type AiChatTurnPhase = 'idle' | 'streaming' | 'executing_tools' | 'awaiting_user';

/**
 * Progress state for one visible tool row in the active turn.
 */
export type AiChatToolRowStatus = 'running' | 'done' | 'error';

/**
 * Normalized tool progress row shown during an active turn.
 */
export interface AiChatToolRow {
  /**
   * Provider tool call id used to correlate call/result events.
   */
  callId: string;

  /**
   * Tool name announced by the model or runtime.
   */
  name: string;

  /**
   * Runtime that owns execution for the tool call.
   */
  owner: AiChatStreamToolOwner;

  /**
   * Live progress state for the tool row.
   */
  status: AiChatToolRowStatus;

  /**
   * UI-safe summary text when a result is available.
   */
  summary?: string;

  /**
   * Whether the tool result reported success.
   */
  ok?: boolean;
}

/**
 * Pending `ask_user` question data retained while a turn is paused.
 */
export interface AiChatPendingQuestion {
  /**
   * Tool call id for the paused `ask_user` invocation.
   */
  toolCallId: string;

  /**
   * Question text presented to the user.
   */
  question: string;

  /**
   * Optional multiple-choice answers.
   */
  choices?: string[];
}

/**
 * Ephemeral in-flight turn state kept separate from persisted chat messages.
 */
export interface AiChatActiveTurn {
  /**
   * Stable turn identifier for renderer orchestration.
   */
  turnId: string;

  /**
   * Current lifecycle phase for the active turn.
   */
  phase: AiChatTurnPhase;

  /**
   * Accumulated assistant text for the active step/turn.
   */
  text: string;

  /**
   * Accumulated ephemeral thought text for the active step/turn.
   */
  thought: string;

  /**
   * Visible tool progress rows for the active turn.
   */
  toolRows: AiChatToolRow[];

  /**
   * Zero-based renderer outer-loop step index for the active invoke.
   */
  stepIndex: number;

  /**
   * Pending `ask_user` question while the turn is paused.
   */
  pendingQuestion?: AiChatPendingQuestion;

  /**
   * In-memory step messages required to resume a paused tool loop.
   */
  stepMessages: ChatStepMessage[];

  /**
   * Model routing retained while an `ask_user` pause unwinds the send thunk.
   */
  model?: string;

  /**
   * Team Hub routing retained for a paused turn.
   */
  hubId?: string;

  /**
   * Plugin-facing user content retained until the terminal after-turn hook.
   */
  userContent?: string;

  /**
   * Wall-clock start used to preserve duration across pause and resume.
   */
  startedAt?: number;

  /**
   * Completed provider steps retained across pause and resume.
   */
  stepCount?: number;

  /**
   * Desktop tool calls processed before the current pause.
   */
  toolCallCount?: number;
}

/**
 * Brief assistant markdown held after `turn.end` until the persisted message arrives.
 */
export interface AiChatHandoffPresentation {
  /**
   * Assistant markdown shown live until the matching persisted row lands.
   */
  text: string;
}

export interface AiChatState {
  chats: ChatSummary[];
  openTabIds: number[];
  activeChatId: number | null;
  messagesByChat: Record<number, ChatMessage[]>;
  selectedModelByChat: Record<number, string>;
  hubModelGroups: HubLlmModelGroup[];
  /**
   * GitHub Models sign-in status for chat model availability.
   */
  githubModelsStatus: GithubModelsStatus;
  historyOpen: boolean;
  sendingByChat: Record<number, boolean>;
  sendErrorByChat: Record<number, string>;
  /**
   * Assistant message ids currently typewriter-revealing, keyed by chat id.
   */
  revealingMessageIdByChat: Record<number, number>;
  /**
   * In-flight LLM step request ids keyed by chat id for cancellation.
   */
  activeStepRequestIdByChat: Record<number, string>;
  /**
   * Whether the user requested cancellation for a chat send loop.
   */
  cancelRequestedByChat: Record<number, boolean>;
  /**
   * One-shot composer text set by external UI (for example script "Ask AI" buttons).
   */
  pendingComposerText: string | null;

  /**
   * Chat id that should receive keyboard focus after creation, or null when none is pending.
   */
  pendingComposerFocusChatId: number | null;

  /**
   * When true, plain Enter submits the chat composer; when false, Ctrl/Cmd+Enter submits.
   */
  enterToSend: boolean;

  /**
   * Ephemeral active turns keyed by chat id.
   */
  activeTurnByChat: Record<number, AiChatActiveTurn>;

  /**
   * Turn identifiers that own mutable send lifecycle state, including pre-stream plugin work.
   */
  lifecycleTurnIdByChat: Record<number, string>;

  /**
   * Assistant markdown awaiting persistence after a streamed turn completes.
   */
  handoffPresentationByChat: Record<number, AiChatHandoffPresentation>;

  /**
   * Assistant message ids that should skip cosmetic typewriter reveal after streaming.
   */
  skipRevealMessageIdByChat: Record<number, number>;
}

const initialState: AiChatState = {
  chats: [],
  openTabIds: [],
  activeChatId: null,
  messagesByChat: {},
  selectedModelByChat: {},
  hubModelGroups: [],
  githubModelsStatus: { connected: false },
  historyOpen: false,
  sendingByChat: {},
  sendErrorByChat: {},
  revealingMessageIdByChat: {},
  activeStepRequestIdByChat: {},
  cancelRequestedByChat: {},
  pendingComposerText: null,
  pendingComposerFocusChatId: null,
  enterToSend: true,
  activeTurnByChat: {},
  lifecycleTurnIdByChat: {},
  handoffPresentationByChat: {},
  skipRevealMessageIdByChat: {}
};

/**
 * Sets `sendingByChat` for a chat when network/model work or desktop tool execution is active.
 *
 * @param state - Mutable AI chat slice state.
 * @param chatId - Chat id receiving the sending flag update.
 * @param sending - Whether the chat should appear in-flight to the composer and message list.
 */
function setChatSending(state: AiChatState, chatId: number, sending: boolean): void {
  if (sending) {
    state.sendingByChat[chatId] = true;
  } else {
    delete state.sendingByChat[chatId];
  }
}

/**
 * Returns the active turn for a chat when present.
 *
 * @param state - AI chat slice state.
 * @param chatId - Chat id owning the active turn.
 */
function getActiveTurn(state: AiChatState, chatId: number): AiChatActiveTurn | undefined {
  return state.activeTurnByChat[chatId];
}

/**
 * Returns whether a turn still owns a chat's lifecycle state.
 *
 * @param state - AI chat slice state.
 * @param chatId - Chat whose lifecycle owner is being checked.
 * @param turnId - Turn attempting to mutate lifecycle state.
 * @returns Whether the turn remains the lifecycle owner.
 */
function ownsTurnLifecycle(state: AiChatState, chatId: number, turnId: string): boolean {
  return state.lifecycleTurnIdByChat[chatId] === turnId;
}

/**
 * Clears ephemeral active-turn state and sending flags for one chat.
 *
 * @param state - Mutable AI chat slice state.
 * @param chatId - Chat id whose active turn should be discarded.
 */
function clearActiveTurnState(state: AiChatState, chatId: number): void {
  delete state.activeTurnByChat[chatId];
  delete state.sendingByChat[chatId];
  delete state.activeStepRequestIdByChat[chatId];
}

/**
 * Clears streamed handoff and skip-reveal bookkeeping for one chat.
 *
 * @param state - Mutable AI chat slice state.
 * @param chatId - Chat id whose handoff state should be discarded.
 */
function clearHandoffPresentationState(state: AiChatState, chatId: number): void {
  delete state.handoffPresentationByChat[chatId];
  delete state.skipRevealMessageIdByChat[chatId];
}

const aiChatSlice = createSlice({
  name: 'aiChat',
  initialState,
  reducers: {
    /**
     * Replaces the chat history list from persistence.
     */
    setChats(state, action: PayloadAction<ChatSummary[]>) {
      state.chats = action.payload;
    },
    /**
     * Sets the active chat tab.
     */
    setActiveChat(state, action: PayloadAction<number | null>) {
      if (state.activeChatId != null && state.activeChatId !== action.payload) {
        delete state.revealingMessageIdByChat[state.activeChatId];
      }
      state.activeChatId = action.payload;
    },
    /**
     * Opens a chat in the tab bar when it is not already open.
     */
    openChatTab(state, action: PayloadAction<number>) {
      if (!state.openTabIds.includes(action.payload)) {
        state.openTabIds.push(action.payload);
      }
      if (state.activeChatId != null && state.activeChatId !== action.payload) {
        delete state.revealingMessageIdByChat[state.activeChatId];
      }
      state.activeChatId = action.payload;
    },
    /**
     * Restores open tabs and active chat from persisted session state.
     */
    restoreChatSession(
      state,
      action: PayloadAction<{ openTabIds: number[]; activeChatId: number | null }>
    ) {
      state.openTabIds = action.payload.openTabIds;
      state.activeChatId = action.payload.activeChatId;
    },
    /**
     * Reorders open chat tabs to match the tab bar display order after drag-and-drop.
     */
    reorderChatTabs(state, action: PayloadAction<number[]>) {
      const orderedTabIds = action.payload;
      if (orderedTabIds.length !== state.openTabIds.length) {
        return;
      }

      const openTabIdSet = new Set(state.openTabIds);
      if (orderedTabIds.some((id) => !openTabIdSet.has(id))) {
        return;
      }

      state.openTabIds = orderedTabIds;
    },
    /**
     * Closes a chat tab and activates a neighbor when needed.
     */
    closeChatTab(state, action: PayloadAction<number>) {
      const chatId = action.payload;
      const index = state.openTabIds.indexOf(chatId);
      if (index === -1) return;

      const nextTabIds = state.openTabIds.filter((id) => id !== chatId);
      state.openTabIds = nextTabIds;

      if (state.activeChatId === chatId) {
        const neighbor = nextTabIds[Math.min(index, nextTabIds.length - 1)] ?? null;
        state.activeChatId = neighbor;
      }

      if (state.pendingComposerFocusChatId === chatId) {
        state.pendingComposerFocusChatId = null;
      }

      delete state.revealingMessageIdByChat[chatId];
      delete state.activeTurnByChat[chatId];
      delete state.lifecycleTurnIdByChat[chatId];
      delete state.sendingByChat[chatId];
      clearHandoffPresentationState(state, chatId);
    },
    /**
     * Replaces messages for a chat loaded from persistence.
     */
    setMessages(state, action: PayloadAction<{ chatId: number; messages: ChatMessage[] }>) {
      state.messagesByChat[action.payload.chatId] = action.payload.messages;
      delete state.revealingMessageIdByChat[action.payload.chatId];
      clearHandoffPresentationState(state, action.payload.chatId);
    },
    /**
     * Marks an assistant message for display-only typewriter reveal.
     */
    startMessageReveal(state, action: PayloadAction<{ chatId: number; messageId: number }>) {
      const { chatId, messageId } = action.payload;
      if (state.skipRevealMessageIdByChat[chatId] === messageId) {
        delete state.skipRevealMessageIdByChat[chatId];
        return;
      }
      state.revealingMessageIdByChat[chatId] = messageId;
    },
    /**
     * Clears typewriter reveal tracking for a chat.
     */
    clearMessageReveal(state, action: PayloadAction<number>) {
      delete state.revealingMessageIdByChat[action.payload];
    },
    /**
     * Appends a single message to a chat in memory.
     */
    appendMessage(state, action: PayloadAction<ChatMessage>) {
      const message = action.payload;
      const { chatId } = message;
      const handoff = state.handoffPresentationByChat[chatId];
      if (message.role === 'assistant' && handoff != null && message.content === handoff.text) {
        state.skipRevealMessageIdByChat[chatId] = message.id;
        delete state.handoffPresentationByChat[chatId];
      }
      const existing = state.messagesByChat[chatId] ?? [];
      state.messagesByChat[chatId] = [...existing, message];
    },
    /**
     * Stores the selected model for a chat tab.
     */
    setSelectedModel(state, action: PayloadAction<{ chatId: number; modelId: string }>) {
      state.selectedModelByChat[action.payload.chatId] = action.payload.modelId;
    },
    /**
     * Toggles the chat history popover open state.
     */
    toggleHistory(state) {
      state.historyOpen = !state.historyOpen;
    },
    /**
     * Sets whether the chat history popover is open.
     */
    setHistoryOpen(state, action: PayloadAction<boolean>) {
      state.historyOpen = action.payload;
    },
    /**
     * Tracks in-flight send state for a chat.
     */
    setSending(
      state,
      action: PayloadAction<{ chatId: number; sending: boolean; turnId?: string }>
    ) {
      if (
        action.payload.turnId != null &&
        !ownsTurnLifecycle(state, action.payload.chatId, action.payload.turnId)
      ) {
        return;
      }
      if (action.payload.sending) {
        state.sendingByChat[action.payload.chatId] = true;
      } else {
        delete state.sendingByChat[action.payload.chatId];
      }
    },
    /**
     * Replaces hub model groups discovered from configured Team Hubs.
     */
    setHubModelGroups(state, action: PayloadAction<HubLlmModelGroup[]>) {
      state.hubModelGroups = action.payload;
    },
    /**
     * Replaces GitHub Models connection status for chat model availability.
     */
    setGithubModelsStatus(state, action: PayloadAction<GithubModelsStatus>) {
      state.githubModelsStatus = action.payload;
    },
    /**
     * Stores a send failure message for a chat tab.
     */
    setSendError(state, action: PayloadAction<{ chatId: number; message: string }>) {
      state.sendErrorByChat[action.payload.chatId] = action.payload.message;
    },
    /**
     * Clears a send failure message for a chat tab.
     */
    clearSendError(state, action: PayloadAction<number>) {
      delete state.sendErrorByChat[action.payload];
    },
    /**
     * Tracks the active LLM step request id for a chat send loop.
     */
    setActiveStepRequestId(
      state,
      action: PayloadAction<{ chatId: number; stepRequestId: string | null; turnId?: string }>
    ) {
      if (
        action.payload.turnId != null &&
        !ownsTurnLifecycle(state, action.payload.chatId, action.payload.turnId)
      ) {
        return;
      }
      if (action.payload.stepRequestId == null) {
        delete state.activeStepRequestIdByChat[action.payload.chatId];
      } else {
        state.activeStepRequestIdByChat[action.payload.chatId] = action.payload.stepRequestId;
      }
    },
    /**
     * Marks a chat send loop as cancelled by the user.
     */
    requestChatCancel(state, action: PayloadAction<number>) {
      state.cancelRequestedByChat[action.payload] = true;
    },
    /**
     * Clears cancellation tracking for a chat send loop.
     */
    clearChatCancelState(
      state,
      action: PayloadAction<number | { chatId: number; turnId: string }>
    ) {
      const payload =
        typeof action.payload === 'number' ? { chatId: action.payload } : action.payload;
      const turnId = typeof action.payload === 'number' ? undefined : action.payload.turnId;
      const active = getActiveTurn(state, payload.chatId);
      if (turnId != null && active != null && active.turnId !== turnId) {
        return;
      }
      if (turnId != null && !ownsTurnLifecycle(state, payload.chatId, turnId)) {
        return;
      }
      delete state.activeStepRequestIdByChat[payload.chatId];
      delete state.cancelRequestedByChat[payload.chatId];
    },
    /**
     * Queues text for the chat composer to consume on the next render.
     */
    setPendingComposerText(state, action: PayloadAction<string | null>) {
      state.pendingComposerText = action.payload;
    },
    /**
     * Requests keyboard focus on the composer for a newly created chat (consumed once by ChatComposer).
     */
    requestComposerFocus(state, action: PayloadAction<number>) {
      state.pendingComposerFocusChatId = action.payload;
    },
    /**
     * Clears a pending composer focus request after it is handled or superseded.
     */
    clearComposerFocus(state) {
      state.pendingComposerFocusChatId = null;
    },
    /**
     * Sets whether plain Enter submits the chat composer.
     */
    setEnterToSend(state, action: PayloadAction<boolean>) {
      state.enterToSend = action.payload;
    },
    /**
     * Clears ephemeral active-turn state for a chat without touching persisted messages.
     */
    clearActiveTurn(state, action: PayloadAction<number>) {
      clearActiveTurnState(state, action.payload);
    },
    /**
     * Immediately invalidates a turn when cancellation begins so late main-process
     * deltas cannot revive its partial text, thought, or tool presentation.
     */
    invalidateActiveTurn(state, action: PayloadAction<number>) {
      clearHandoffPresentationState(state, action.payload);
      clearActiveTurnState(state, action.payload);
    },
    /**
     * Claims mutable lifecycle state before asynchronous pre-stream work begins.
     */
    claimTurnLifecycle(state, action: PayloadAction<{ chatId: number; turnId: string }>) {
      state.lifecycleTurnIdByChat[action.payload.chatId] = action.payload.turnId;
    },
    /**
     * Releases lifecycle ownership after matching terminal cleanup completes.
     */
    releaseTurnLifecycle(state, action: PayloadAction<{ chatId: number; turnId: string }>) {
      if (ownsTurnLifecycle(state, action.payload.chatId, action.payload.turnId)) {
        delete state.lifecycleTurnIdByChat[action.payload.chatId];
      }
    },
    /**
     * Saves protocol and plugin context required to resume an awaiting-user turn.
     */
    storeActiveTurnContext(
      state,
      action: PayloadAction<{
        chatId: number;
        turnId: string;
        messages: ChatStepMessage[];
        userContent: string;
        startedAt: number;
        stepCount: number;
        toolCallCount: number;
      }>
    ) {
      const active = getActiveTurn(state, action.payload.chatId);
      if (!active || active.turnId !== action.payload.turnId) {
        return;
      }
      active.stepMessages = action.payload.messages;
      active.userContent = action.payload.userContent;
      active.startedAt = action.payload.startedAt;
      active.stepCount = action.payload.stepCount;
      active.toolCallCount = action.payload.toolCallCount;
    },
    /**
     * Restores a durable `ask_user` pause without starting any model work.
     */
    recoverPendingTurn(state, action: PayloadAction<PendingAiChatTurn>) {
      const pending = action.payload;
      state.lifecycleTurnIdByChat[pending.chatId] = pending.turnId;
      state.activeTurnByChat[pending.chatId] = {
        turnId: pending.turnId,
        phase: 'awaiting_user',
        text: '',
        thought: '',
        toolRows: [],
        stepIndex: Math.max(0, pending.rendererStepCount - 1),
        pendingQuestion: {
          toolCallId: pending.toolCallId,
          question: pending.question,
          ...(pending.choices != null ? { choices: pending.choices } : {})
        },
        stepMessages: pending.messages,
        model: pending.model,
        ...(pending.hubId != null ? { hubId: pending.hubId } : {}),
        ...(pending.userContent != null ? { userContent: pending.userContent } : {}),
        startedAt: Date.parse(pending.updatedAt) || Date.now(),
        stepCount: pending.rendererStepCount,
        toolCallCount: pending.toolCallCount
      };
      setChatSending(state, pending.chatId, false);
    },
    /**
     * Hands a user answer into the paused protocol state before the next streamed step.
     */
    resumeActiveTurn(
      state,
      action: PayloadAction<{
        chatId: number;
        turnId: string;
        messages: ChatStepMessage[];
      }>
    ) {
      const active = getActiveTurn(state, action.payload.chatId);
      if (!active || active.turnId !== action.payload.turnId) {
        return;
      }
      active.stepMessages = action.payload.messages;
      delete active.pendingQuestion;
      active.phase = 'streaming';
      setChatSending(state, action.payload.chatId, true);
    },
    /**
     * Applies one normalized AI chat stream event to ephemeral active-turn state.
     */
    applyAiChatStreamEvent(state, action: PayloadAction<AiChatStreamRendererMessage>) {
      const { chatId, event } = action.payload;

      if (event.type === 'turn.start') {
        state.lifecycleTurnIdByChat[chatId] = event.turnId;
        state.activeTurnByChat[chatId] = {
          turnId: event.turnId,
          phase: 'streaming',
          text: '',
          thought: '',
          toolRows: [],
          stepIndex: 0,
          stepMessages: [],
          model: event.model,
          ...(event.hubId != null ? { hubId: event.hubId } : {}),
          stepCount: 0,
          toolCallCount: 0
        };
        setChatSending(state, chatId, true);
        return;
      }

      const active = getActiveTurn(state, chatId);
      if (!active || active.turnId !== event.turnId) {
        return;
      }

      switch (event.type) {
        case 'step.start':
          active.stepIndex = event.stepIndex;
          active.phase = 'streaming';
          setChatSending(state, chatId, true);
          break;
        case 'delta.text':
          active.text += event.chunk;
          active.phase = 'streaming';
          setChatSending(state, chatId, true);
          break;
        case 'delta.thought':
          active.thought += event.chunk;
          active.phase = 'streaming';
          setChatSending(state, chatId, true);
          break;
        case 'tool.call':
          active.toolRows.push({
            callId: event.callId,
            name: event.name,
            owner: event.owner,
            status: 'running'
          });
          active.phase = 'executing_tools';
          setChatSending(state, chatId, true);
          break;
        case 'tool.result': {
          const existingRow = active.toolRows.find((row) => row.callId === event.callId);
          const status: AiChatToolRowStatus = event.ok === false ? 'error' : 'done';
          if (existingRow) {
            existingRow.status = status;
            existingRow.summary = event.summary;
            existingRow.ok = event.ok;
          } else {
            active.toolRows.push({
              callId: event.callId,
              name: event.name,
              owner: event.owner,
              status,
              summary: event.summary,
              ok: event.ok
            });
          }
          active.phase = 'executing_tools';
          setChatSending(state, chatId, true);
          break;
        }
        case 'step.end':
          active.stepIndex = event.stepIndex;
          break;
        case 'turn.awaiting_user':
          active.phase = 'awaiting_user';
          active.pendingQuestion = {
            toolCallId: event.toolCallId,
            question: event.question,
            choices: event.choices
          };
          setChatSending(state, chatId, false);
          break;
        case 'turn.end': {
          const handoffText = event.content ?? active.text;
          if (handoffText.length > 0) {
            state.handoffPresentationByChat[chatId] = { text: handoffText };
          }
          clearActiveTurnState(state, chatId);
          break;
        }
        case 'turn.error':
        case 'turn.cancelled':
          clearHandoffPresentationState(state, chatId);
          clearActiveTurnState(state, chatId);
          break;
        default:
          break;
      }
    }
  }
});

export const {
  setChats,
  setActiveChat,
  openChatTab,
  restoreChatSession,
  reorderChatTabs,
  closeChatTab,
  setMessages,
  appendMessage,
  setSelectedModel,
  toggleHistory,
  setHistoryOpen,
  setHubModelGroups,
  setGithubModelsStatus,
  setSending,
  startMessageReveal,
  clearMessageReveal,
  setActiveStepRequestId,
  requestChatCancel,
  clearChatCancelState,
  setSendError,
  clearSendError,
  setPendingComposerText,
  requestComposerFocus,
  clearComposerFocus,
  setEnterToSend,
  clearActiveTurn,
  invalidateActiveTurn,
  claimTurnLifecycle,
  releaseTurnLifecycle,
  storeActiveTurnContext,
  recoverPendingTurn,
  resumeActiveTurn,
  applyAiChatStreamEvent
} = aiChatSlice.actions;

/**
 * Returns all chats in history order.
 */
export const selectChatHistory = (state: RootState): ChatSummary[] => state.aiChat.chats;

/**
 * Returns ids of chats open in the tab bar this session.
 */
export const selectOpenChatTabIds = (state: RootState): number[] => state.aiChat.openTabIds;

/**
 * Returns the active chat tab id, if any.
 */
export const selectActiveChatId = (state: RootState): number | null => state.aiChat.activeChatId;

/**
 * Returns messages keyed by chat id.
 */
export const selectMessagesByChat = (state: RootState): Record<number, ChatMessage[]> =>
  state.aiChat.messagesByChat;

/**
 * Returns selected model ids keyed by chat id.
 */
export const selectSelectedModelByChat = (state: RootState): Record<number, string> =>
  state.aiChat.selectedModelByChat;

/**
 * Returns hub LLM model groups loaded from configured Team Hubs.
 */
export const selectHubModelGroups = (state: RootState): HubLlmModelGroup[] =>
  state.aiChat.hubModelGroups;

/**
 * Returns GitHub Models connection status for chat model availability.
 */
export const selectGithubModelsStatus = (state: RootState): GithubModelsStatus =>
  state.aiChat.githubModelsStatus;

/**
 * Returns whether GitHub Models sign-in is active.
 */
export const selectGithubModelsConnected = (state: RootState): boolean =>
  state.aiChat.githubModelsStatus.connected;

/**
 * Returns whether the chat history popover is open.
 */
export const selectHistoryOpen = (state: RootState): boolean => state.aiChat.historyOpen;

/**
 * Returns send-in-progress flags keyed by chat id.
 */
export const selectSendingByChat = (state: RootState): Record<number, boolean> =>
  state.aiChat.sendingByChat;

/**
 * Returns assistant message ids currently typewriter-revealing, keyed by chat id.
 */
export const selectRevealingMessageIdByChat = (state: RootState): Record<number, number> =>
  state.aiChat.revealingMessageIdByChat;

/**
 * Returns send failure messages keyed by chat id.
 */
export const selectSendErrorByChat = (state: RootState): Record<number, string> =>
  state.aiChat.sendErrorByChat;

/**
 * Returns in-flight LLM step request ids keyed by chat id.
 */
export const selectActiveStepRequestIdByChat = (state: RootState): Record<number, string> =>
  state.aiChat.activeStepRequestIdByChat;

/**
 * Returns user-requested cancellation flags keyed by chat id.
 */
export const selectCancelRequestedByChat = (state: RootState): Record<number, boolean> =>
  state.aiChat.cancelRequestedByChat;

/**
 * Returns composer text queued by external UI, or null when none is pending.
 */
export const selectPendingComposerText = (state: RootState): string | null =>
  state.aiChat.pendingComposerText;

/**
 * Returns the chat id queued for composer focus, or null when none is pending.
 */
export const selectPendingComposerFocusChatId = (state: RootState): number | null =>
  state.aiChat.pendingComposerFocusChatId;

/**
 * Returns whether plain Enter submits the chat composer.
 */
export const selectEnterToSend = (state: RootState): boolean => state.aiChat.enterToSend;

/**
 * Returns ephemeral active turns keyed by chat id.
 */
export const selectActiveTurnByChat = (state: RootState): Record<number, AiChatActiveTurn> =>
  state.aiChat.activeTurnByChat;

/**
 * Returns the active turn for one chat, if any.
 */
export const selectActiveTurnForChat =
  (chatId: number) =>
  (state: RootState): AiChatActiveTurn | undefined =>
    state.aiChat.activeTurnByChat[chatId];

/**
 * Returns streamed handoff markdown keyed by chat id.
 */
export const selectHandoffPresentationByChat = (
  state: RootState
): Record<number, AiChatHandoffPresentation> => state.aiChat.handoffPresentationByChat;

/**
 * Returns the streamed handoff presentation for one chat, if any.
 */
export const selectHandoffPresentationForChat =
  (chatId: number) =>
  (state: RootState): AiChatHandoffPresentation | undefined =>
    state.aiChat.handoffPresentationByChat[chatId];

/**
 * Returns assistant message ids that should skip typewriter reveal keyed by chat id.
 */
export const selectSkipRevealMessageIdByChat = (state: RootState): Record<number, number> =>
  state.aiChat.skipRevealMessageIdByChat;

export default aiChatSlice.reducer;
