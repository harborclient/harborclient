import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ChatMessage, ChatSummary, HubLlmModelGroup } from '#/shared/types';
import type { RootState } from '#/renderer/src/store/redux';

export interface AiChatState {
  chats: ChatSummary[];
  openTabIds: number[];
  activeChatId: number | null;
  messagesByChat: Record<number, ChatMessage[]>;
  selectedModelByChat: Record<number, string>;
  hubModelGroups: HubLlmModelGroup[];
  historyOpen: boolean;
  sendingByChat: Record<number, boolean>;
  sendErrorByChat: Record<number, string>;
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
   * When true, plain Enter submits the chat composer; when false, Ctrl/Cmd+Enter submits.
   */
  enterToSend: boolean;
}

const initialState: AiChatState = {
  chats: [],
  openTabIds: [],
  activeChatId: null,
  messagesByChat: {},
  selectedModelByChat: {},
  hubModelGroups: [],
  historyOpen: false,
  sendingByChat: {},
  sendErrorByChat: {},
  activeStepRequestIdByChat: {},
  cancelRequestedByChat: {},
  pendingComposerText: null,
  enterToSend: true
};

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
      state.activeChatId = action.payload;
    },
    /**
     * Opens a chat in the tab bar when it is not already open.
     */
    openChatTab(state, action: PayloadAction<number>) {
      if (!state.openTabIds.includes(action.payload)) {
        state.openTabIds.push(action.payload);
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
    },
    /**
     * Replaces messages for a chat loaded from persistence.
     */
    setMessages(state, action: PayloadAction<{ chatId: number; messages: ChatMessage[] }>) {
      state.messagesByChat[action.payload.chatId] = action.payload.messages;
    },
    /**
     * Appends a single message to a chat in memory.
     */
    appendMessage(state, action: PayloadAction<ChatMessage>) {
      const { chatId } = action.payload;
      const existing = state.messagesByChat[chatId] ?? [];
      state.messagesByChat[chatId] = [...existing, action.payload];
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
    setSending(state, action: PayloadAction<{ chatId: number; sending: boolean }>) {
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
      action: PayloadAction<{ chatId: number; stepRequestId: string | null }>
    ) {
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
    clearChatCancelState(state, action: PayloadAction<number>) {
      delete state.activeStepRequestIdByChat[action.payload];
      delete state.cancelRequestedByChat[action.payload];
    },
    /**
     * Queues text for the chat composer to consume on the next render.
     */
    setPendingComposerText(state, action: PayloadAction<string | null>) {
      state.pendingComposerText = action.payload;
    },
    /**
     * Sets whether plain Enter submits the chat composer.
     */
    setEnterToSend(state, action: PayloadAction<boolean>) {
      state.enterToSend = action.payload;
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
  setSending,
  setActiveStepRequestId,
  requestChatCancel,
  clearChatCancelState,
  setSendError,
  clearSendError,
  setPendingComposerText,
  setEnterToSend
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
 * Returns whether the chat history popover is open.
 */
export const selectHistoryOpen = (state: RootState): boolean => state.aiChat.historyOpen;

/**
 * Returns send-in-progress flags keyed by chat id.
 */
export const selectSendingByChat = (state: RootState): Record<number, boolean> =>
  state.aiChat.sendingByChat;

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
 * Returns whether plain Enter submits the chat composer.
 */
export const selectEnterToSend = (state: RootState): boolean => state.aiChat.enterToSend;

export default aiChatSlice.reducer;
