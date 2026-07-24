import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { ChatStepResult } from '../types';
/**
 * Default title for chats that have not received an AI-generated summary yet.
 */
export declare const DEFAULT_CHAT_TITLE = "New Chat";
/**
 * Maximum length for persisted chat tab titles.
 */
export declare const CHAT_TITLE_MAX_LENGTH = 40;
/**
 * OpenAI tool definition for summarizing a user's first message into a chat title.
 */
export declare const CHAT_TITLE_TOOL: ChatCompletionTool;
/**
 * Builds the system prompt for AI chat title generation.
 *
 * @returns System prompt instructing the model to call set_chat_title.
 */
export declare function buildChatTitleSystemPrompt(): string;
/**
 * Normalizes raw title text for persistence and display.
 *
 * @param raw - Title string from the model or user input.
 * @returns Sanitized title, or {@link DEFAULT_CHAT_TITLE} when empty after normalization.
 */
export declare function normalizeChatTitle(raw: string): string;
/**
 * Reads a set_chat_title tool call from a chat step result.
 *
 * @param result - One LLM completion step result.
 * @returns Normalized title, or null when no usable response is present.
 */
export declare function parseChatTitleResult(result: ChatStepResult): string | null;
//# sourceMappingURL=chatTitle.d.ts.map