import { createAsyncThunk } from '@reduxjs/toolkit';
import { buildStubAssistantReply, getAvailableModels } from '#/shared/aiModels';
import type { AiSettings, ChatSummary } from '#/shared/types';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  appendMessage,
  closeChatTab,
  openChatTab,
  setActiveChat,
  setChats,
  setMessages,
  setSelectedModel,
  setSending
} from '#/renderer/src/store/slices/aiChatSlice';

const STUB_REPLY_DELAY_MS = 400;

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
 * Loads a chat's messages into state and opens it as a tab.
 *
 * @param chatId - Chat id to load.
 */
export const loadChat = createAsyncThunk<number, number, ThunkApiConfig>(
  'aiChat/loadChat',
  async (chatId, { dispatch }) => {
    const chat = await window.api.getChat(chatId);
    if (!chat) {
      throw new Error('Chat not found');
    }

    dispatch(setMessages({ chatId, messages: chat.messages }));
    if (chat.model) {
      dispatch(setSelectedModel({ chatId, modelId: chat.model }));
    }
    dispatch(openChatTab(chatId));
    return chatId;
  }
);

/**
 * Initializes AI chat state when the sidebar opens.
 */
export const initializeAiChat = createAsyncThunk<void, AiSettings, ThunkApiConfig>(
  'aiChat/initialize',
  async (aiSettings, { dispatch, getState }) => {
    const { openTabIds, activeChatId } = getState().aiChat;
    if (openTabIds.length > 0 && activeChatId != null) {
      return;
    }

    const summaries = await dispatch(refreshChatHistory()).unwrap();
    const availableModels = getAvailableModels(aiSettings);
    const defaultModel = availableModels[0]?.id;

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
    }
  }
);

/**
 * Creates a new chat tab and selects it.
 */
export const createNewChat = createAsyncThunk<void, AiSettings, ThunkApiConfig>(
  'aiChat/createNewChat',
  async (aiSettings, { dispatch, getState }) => {
    const availableModels = getAvailableModels(aiSettings);
    const defaultModel = availableModels[0]?.id;
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
    await dispatch(refreshChatHistory());
  }
);

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
 * Sends a user message and appends a stub assistant reply.
 */
export const sendChatMessage = createAsyncThunk<
  void,
  { chatId: number; content: string; model?: string },
  ThunkApiConfig
>('aiChat/sendMessage', async ({ chatId, content, model }, { dispatch }) => {
  const trimmed = content.trim();
  if (!trimmed) return;

  const userMessage = await window.api.addChatMessage({
    chatId,
    role: 'user',
    content: trimmed,
    model
  });
  dispatch(appendMessage(userMessage));
  dispatch(setSending({ chatId, sending: true }));

  await new Promise((resolve) => {
    setTimeout(resolve, STUB_REPLY_DELAY_MS);
  });

  const assistantMessage = await window.api.addChatMessage({
    chatId,
    role: 'assistant',
    content: buildStubAssistantReply(trimmed),
    model
  });
  dispatch(appendMessage(assistantMessage));
  dispatch(setSending({ chatId, sending: false }));
  await dispatch(refreshChatHistory());
});

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
