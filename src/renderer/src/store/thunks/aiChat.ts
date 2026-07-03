import { createAsyncThunk } from '@reduxjs/toolkit';
import { getAvailableModels } from '#/shared/aiModels';
import type { AiSettings, ChatMessage, ChatStepMessage, ChatSummary } from '#/shared/types';
import { executeAiToolCall } from '#/renderer/src/store/ai/aiToolExecutor';
import type { RootState, ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  appendMessage,
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
  setSendError,
  setSending
} from '#/renderer/src/store/slices/aiChatSlice';

const MAX_TOOL_ITERATIONS = 6;

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
    dispatch(clearSendError(chatId));
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
    const hubModelGroups = await window.api.listHubLlmModels();
    dispatch(setHubModelGroups(hubModelGroups));

    if (openTabIds.length > 0 && activeChatId != null) {
      return;
    }

    const summaries = await dispatch(refreshChatHistory()).unwrap();
    const availableModels = getAvailableModels(aiSettings, hubModelGroups);
    const defaultModel = availableModels[0]?.id;
    const existingChatIds = new Set(summaries.map((chat) => chat.id));
    const session = await window.api.getAiChatSession();
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
          dispatch(clearSendError(chatId));
          if (chat.model) {
            dispatch(setSelectedModel({ chatId, modelId: chat.model }));
          }
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
    }
  }
);

/**
 * Creates a new chat tab and selects it.
 */
export const createNewChat = createAsyncThunk<void, AiSettings, ThunkApiConfig>(
  'aiChat/createNewChat',
  async (aiSettings, { dispatch, getState }) => {
    const hubModelGroups = getState().aiChat.hubModelGroups;
    const availableModels = getAvailableModels(aiSettings, hubModelGroups);
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

  const userMessage = await window.api.addChatMessage({
    chatId,
    role: 'user',
    content: trimmed,
    model: modelId
  });
  dispatch(appendMessage(userMessage));
  dispatch(setSending({ chatId, sending: true }));

  try {
    dispatch(clearChatCancelState(chatId));
    const messages = historyToStepMessages(getState().aiChat.messagesByChat[chatId] ?? []);
    let assistantText: string | null = null;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
      if (getState().aiChat.cancelRequestedByChat[chatId]) {
        break;
      }

      const stepRequestId = crypto.randomUUID();
      dispatch(setActiveStepRequestId({ chatId, stepRequestId }));

      let step;
      try {
        step = await window.api.completeChatStep(
          {
            model: modelId,
            messages,
            ...(hubId ? { hubId } : {})
          },
          stepRequestId
        );
      } finally {
        dispatch(setActiveStepRequestId({ chatId, stepRequestId: null }));
      }

      if (getState().aiChat.cancelRequestedByChat[chatId]) {
        break;
      }

      if (step.toolCalls && step.toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: step.content,
          tool_calls: step.toolCalls
        });

        for (const call of step.toolCalls) {
          if (getState().aiChat.cancelRequestedByChat[chatId]) {
            break;
          }

          const result = await executeAiToolCall(call.name, call.arguments, {
            getState,
            dispatch
          });
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: result
          });
        }

        if (getState().aiChat.cancelRequestedByChat[chatId]) {
          break;
        }
        continue;
      }

      assistantText = step.content;
      break;
    }

    if (getState().aiChat.cancelRequestedByChat[chatId]) {
      return;
    }

    if (assistantText == null || assistantText.trim() === '') {
      assistantText = 'I could not complete your request.';
    }

    const assistantMessage = await window.api.addChatMessage({
      chatId,
      role: 'assistant',
      content: assistantText,
      model: modelId
    });
    dispatch(appendMessage(assistantMessage));
    await dispatch(refreshChatHistory());
  } catch (error) {
    if (isUserChatCancellation(error, getState(), chatId)) {
      return;
    }
    const message =
      error instanceof Error ? error.message : 'Failed to get a response from the model.';
    dispatch(setSendError({ chatId, message }));
  } finally {
    dispatch(setSending({ chatId, sending: false }));
    dispatch(clearChatCancelState(chatId));
  }
});

/**
 * Cancels the in-flight AI reply for a chat tab.
 */
export const cancelChatMessage = createAsyncThunk<void, number, ThunkApiConfig>(
  'aiChat/cancelMessage',
  async (chatId, { dispatch, getState }) => {
    if (!getState().aiChat.sendingByChat[chatId]) {
      return;
    }

    dispatch(requestChatCancel(chatId));

    const stepRequestId = getState().aiChat.activeStepRequestIdByChat[chatId];
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
