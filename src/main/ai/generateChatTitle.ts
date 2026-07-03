import { runChatCompletionStep } from '#/main/ai/completeChatTurn';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { DEFAULT_CHAT_TITLE, parseChatTitleResult } from '#/shared/aiChatTitle';
import type { GenerateChatTitleInput } from '#/shared/types';

/**
 * Generates and persists a 3-5 word chat title from the user's first message.
 *
 * No-ops when the chat is missing or no longer has the default title.
 *
 * @param input - Chat id, prompt text, and model routing fields.
 * @returns The persisted title, or the current title when generation is skipped or fails.
 */
export async function runGenerateChatTitle(input: GenerateChatTitleInput): Promise<string> {
  const db = getLocalDatabase();
  const chat = db.getChat(input.chatId);
  if (!chat || chat.title !== DEFAULT_CHAT_TITLE) {
    return chat?.title ?? DEFAULT_CHAT_TITLE;
  }

  const prompt = input.prompt.trim();
  if (!prompt) {
    return chat.title;
  }

  const result = await runChatCompletionStep({
    model: input.model,
    messages: [],
    chatTitlePrompt: prompt,
    ...(input.hubId ? { hubId: input.hubId } : {})
  });

  const title = parseChatTitleResult(result);
  if (!title) {
    return chat.title;
  }

  db.updateChatTitle(input.chatId, title);
  return title;
}
