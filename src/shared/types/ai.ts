/**
 * Supported LLM providers for the OpenAI SDK compatibility layer.
 */
export type LlmProvider = 'openai' | 'claude' | 'gemini';

/**
 * Role of a message in an AI chat thread.
 */
export type ChatRole = 'user' | 'assistant';

/**
 * A single message in an AI chat thread.
 */
export interface ChatMessage {
  /**
   * Database row id.
   */
  id: number;

  /**
   * Parent chat id.
   */
  chatId: number;

  /**
   * Whether the message is from the user or the assistant.
   */
  role: ChatRole;

  /**
   * Message body text.
   */
  content: string;

  /**
   * Model id used when the message was sent, if any.
   */
  model?: string;

  /**
   * ISO timestamp when the message was created.
   */
  created_at: string;
}

/**
 * Summary row for a chat in history lists.
 */
export interface ChatSummary {
  /**
   * Database row id.
   */
  id: number;

  /**
   * Display title for the chat tab and history list.
   */
  title: string;

  /**
   * Last selected model id for this chat, if any.
   */
  model?: string;

  /**
   * ISO timestamp when the chat was last updated.
   */
  updated_at: string;

  /**
   * Number of persisted messages in this chat thread.
   */
  message_count: number;
}

/**
 * Full chat record including ordered messages.
 */
export interface Chat extends ChatSummary {
  /**
   * ISO timestamp when the chat was created.
   */
  created_at: string;

  /**
   * Messages in chronological order.
   */
  messages: ChatMessage[];
}

/**
 * Input for creating a new chat.
 */
export interface CreateChatInput {
  /**
   * Optional initial title; defaults to "New Chat".
   */
  title?: string;

  /**
   * Optional initial model id.
   */
  model?: string;
}

/**
 * Input for appending a message to a chat.
 */
export interface AddChatMessageInput {
  /**
   * Parent chat id.
   */
  chatId: number;

  /**
   * Message author role.
   */
  role: ChatRole;

  /**
   * Message body text.
   */
  content: string;

  /**
   * Model id used for this message, if any.
   */
  model?: string;
}

/**
 * Input for generating an AI chat title from the user's first message.
 */
export interface GenerateChatTitleInput {
  /**
   * Chat id to update when title generation succeeds.
   */
  chatId: number;

  /**
   * User's first message text to summarize.
   */
  prompt: string;

  /**
   * Provider-specific model id selected in the composer.
   */
  model: string;

  /**
   * Team Hub id when the selected model is hub-proxied.
   */
  hubId?: string;
}

/**
 * Role of a message in an LLM completion step (includes tool roles).
 */
export type ChatStepMessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Serializable tool call returned from a completion step.
 */
export interface ChatToolCall {
  /**
   * Tool call id from the model.
   */
  id: string;

  /**
   * Tool function name.
   */
  name: string;

  /**
   * JSON-encoded tool arguments.
   */
  arguments: string;
}

/**
 * Serializable message passed to a single LLM completion step.
 */
export interface ChatStepMessage {
  /**
   * OpenAI-compatible message role.
   */
  role: ChatStepMessageRole;

  /**
   * Text content for user, assistant, tool, or system messages.
   */
  content?: string | null;

  /**
   * Tool calls requested by the assistant.
   */
  tool_calls?: ChatToolCall[];

  /**
   * Tool call id this tool message responds to.
   */
  tool_call_id?: string;

  /**
   * Tool name for tool role messages (optional).
   */
  name?: string;
}

/**
 * Input for one stateless LLM completion step.
 */
export interface ChatStepInput {
  /**
   * Provider-specific model id selected in the composer.
   */
  model: string;

  /**
   * Conversation messages excluding the system prompt (injected in main).
   */
  messages: ChatStepMessage[];

  /**
   * Team Hub id when the selected model is hub-proxied.
   */
  hubId?: string;

  /**
   * Inline script `/ask` context; switches to the mini-agent prompt and answer_script tool.
   */
  scriptAsk?: ScriptAskContext;

  /**
   * User's first message for AI chat title generation; switches to the title prompt and set_chat_title tool.
   */
  chatTitlePrompt?: string;

  /**
   * Dedicated agent mode for isolated tool sets (for example commit-message generation).
   */
  agentVariant?: 'commitMessage';
}

/**
 * Context for an inline script `/ask` completion step.
 */
export interface ScriptAskContext {
  /**
   * Full JavaScript source from the script editor.
   */
  code: string;

  /**
   * 1-based line number where the user typed the slash command.
   */
  line: number;

  /**
   * Script phase: pre-request or post-request.
   */
  phase: 'pre' | 'post';
}

/**
 * One LLM model offered by a Team Hub.
 */
export interface HubLlmModel {
  /**
   * Provider-specific model id.
   */
  id: string;

  /**
   * Human-readable label from the hub.
   */
  label: string;

  /**
   * LLM provider that owns this model.
   */
  provider: LlmProvider;
}

/**
 * Models returned from a single configured Team Hub.
 */
export interface HubLlmModelGroup {
  /**
   * Team Hub identifier from local settings.
   */
  hubId: string;

  /**
   * Display name of the Team Hub.
   */
  hubName: string;

  /**
   * Models the authenticated user may use on this hub.
   */
  models: HubLlmModel[];

  /**
   * When true, the hub has an OpenAI provider key for docs search and OpenAI models.
   */
  hasOpenAi: boolean;
}

/**
 * Result of one LLM completion step.
 */
export interface ChatStepResult {
  /**
   * Assistant text when the model finishes without tool calls.
   */
  content: string | null;

  /**
   * Tool calls to execute in the renderer when present.
   */
  toolCalls?: ChatToolCall[];
}
