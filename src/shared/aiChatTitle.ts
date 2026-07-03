import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { ChatStepResult } from '#/shared/types';

/**
 * Default title for chats that have not received an AI-generated summary yet.
 */
export const DEFAULT_CHAT_TITLE = 'New Chat';

/**
 * Maximum length for persisted chat tab titles.
 */
export const CHAT_TITLE_MAX_LENGTH = 40;

/**
 * OpenAI tool definition for summarizing a user's first message into a chat title.
 */
export const CHAT_TITLE_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'set_chat_title',
    description: 'Sets a short 3-5 word title that summarizes the user question.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'A 3-5 word summary of the user question. No quotes or trailing punctuation.'
        }
      },
      required: ['title'],
      additionalProperties: false
    }
  }
};

/**
 * Builds the system prompt for AI chat title generation.
 *
 * @returns System prompt instructing the model to call set_chat_title.
 */
export function buildChatTitleSystemPrompt(): string {
  return `You summarize user questions into very short chat titles.

Rules:
1. Always respond by calling the set_chat_title tool exactly once.
2. The title must be 3-5 words that capture the topic of the user's first message.
3. Do not use quotation marks or trailing punctuation.
4. Use title case only when it reads naturally; otherwise use sentence-style wording.
5. Do not include explanations or extra text outside the tool call.`;
}

/**
 * Normalizes raw title text for persistence and display.
 *
 * @param raw - Title string from the model or user input.
 * @returns Sanitized title, or {@link DEFAULT_CHAT_TITLE} when empty after normalization.
 */
export function normalizeChatTitle(raw: string): string {
  let normalized = raw.trim().replace(/\s+/g, ' ');
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  normalized = normalized.replace(/[.!?;:]+$/, '').trim();
  if (!normalized) {
    return DEFAULT_CHAT_TITLE;
  }
  if (normalized.length <= CHAT_TITLE_MAX_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, CHAT_TITLE_MAX_LENGTH - 1)}…`;
}

/**
 * Parses tool arguments JSON from a set_chat_title call.
 *
 * @param raw - Raw JSON arguments string from the model.
 * @returns Normalized title, or null when parsing fails or title is empty.
 */
function parseSetChatTitleArgs(raw: string): string | null {
  if (!raw.trim()) {
    return null;
  }

  const parsed = JSON.parse(raw) as { title?: unknown };
  if (typeof parsed.title !== 'string' || !parsed.title.trim()) {
    return null;
  }

  const normalized = normalizeChatTitle(parsed.title);
  if (normalized === DEFAULT_CHAT_TITLE) {
    return null;
  }
  return normalized;
}

/**
 * Reads a set_chat_title tool call from a chat step result.
 *
 * @param result - One LLM completion step result.
 * @returns Normalized title, or null when no usable response is present.
 */
export function parseChatTitleResult(result: ChatStepResult): string | null {
  const toolCall = result.toolCalls?.find((call) => call.name === 'set_chat_title');
  if (toolCall) {
    try {
      return parseSetChatTitleArgs(toolCall.arguments);
    } catch {
      return null;
    }
  }

  const content = result.content?.trim();
  if (content) {
    const normalized = normalizeChatTitle(content);
    return normalized === DEFAULT_CHAT_TITLE ? null : normalized;
  }

  return null;
}
