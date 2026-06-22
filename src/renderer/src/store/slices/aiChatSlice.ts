import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ChatMessage, ChatSummary } from '#/shared/types';
import type { RootState } from '#/renderer/src/store/redux';

export interface AiChatState {
  chats: ChatSummary[];
  openTabIds: number[];
  activeChatId: number | null;
  messagesByChat: Record<number, ChatMessage[]>;
  selectedModelByChat: Record<number, string>;
  historyOpen: boolean;
  sendingByChat: Record<number, boolean>;
}

const initialState: AiChatState = {
  chats: [],
  openTabIds: [],
  activeChatId: null,
  messagesByChat: {},
  selectedModelByChat: {},
  historyOpen: false,
  sendingByChat: {}
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
    }
  }
});

export const {
  setChats,
  setActiveChat,
  openChatTab,
  closeChatTab,
  setMessages,
  appendMessage,
  setSelectedModel,
  toggleHistory,
  setHistoryOpen,
  setSending
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
 * Returns whether the chat history popover is open.
 */
export const selectHistoryOpen = (state: RootState): boolean => state.aiChat.historyOpen;

/**
 * Returns send-in-progress flags keyed by chat id.
 */
export const selectSendingByChat = (state: RootState): Record<number, boolean> =>
  state.aiChat.sendingByChat;

export default aiChatSlice.reducer;
