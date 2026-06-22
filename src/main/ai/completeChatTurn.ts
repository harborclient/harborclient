import { APIError, type OpenAI } from 'openai';
import type { ChatCompletion, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { LlmClientFactory } from '#/main/ai/LlmClientFactory';
import { truncateChatStepMessages } from '#/shared/aiChatContext';
import { getAiModelById } from '#/shared/aiModels';
import { AI_SYSTEM_PROMPT, AI_TOOL_DEFINITIONS } from '#/shared/aiTools';
import type { ChatStepInput, ChatStepMessage, ChatStepResult, LlmProvider } from '#/shared/types';

/**
 * User-facing message when the model context limit is exceeded even after recovery.
 */
const CONTEXT_LENGTH_ERROR_MESSAGE =
  'The conversation is too long for this model. Start a new chat or ask about a smaller response.';

/**
 * Dependencies injectable for unit tests.
 */
export interface RunChatCompletionStepDeps {
  /**
   * Builds an OpenAI SDK client for the requested provider.
   */
  createClient: (provider: LlmProvider) => OpenAI;
}

/**
 * Reads assistant text from a chat completion response when no tool calls are present.
 *
 * @param response - OpenAI SDK chat completion result.
 * @returns Assistant message text, which may be empty.
 */
export function extractAssistantContent(response: ChatCompletion): string | null {
  const content = response.choices[0]?.message?.content;
  if (content == null || content === '') {
    return null;
  }
  if (typeof content === 'string') {
    return content;
  }
  return null;
}

/**
 * Returns whether an error is an OpenAI context length overflow.
 *
 * @param error - Error thrown by the OpenAI SDK.
 */
function isContextLengthExceeded(error: unknown): boolean {
  return error instanceof APIError && error.code === 'context_length_exceeded';
}

/**
 * Normalizes LLM client failures into user-facing errors.
 *
 * @param error - Error thrown by the OpenAI SDK or local validation.
 */
function toChatCompletionError(error: unknown): Error {
  if (isContextLengthExceeded(error)) {
    return new Error(CONTEXT_LENGTH_ERROR_MESSAGE);
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error('Failed to get a response from the model.');
}

/**
 * Converts IPC-safe step messages into OpenAI SDK message parameters.
 *
 * @param messages - Messages from the renderer tool loop.
 */
function toOpenAiMessages(messages: ChatStepMessage[]): ChatCompletionMessageParam[] {
  return messages.map((message) => {
    if (message.role === 'assistant' && message.tool_calls?.length) {
      return {
        role: 'assistant',
        content: message.content ?? null,
        tool_calls: message.tool_calls.map((call) => ({
          id: call.id,
          type: 'function' as const,
          function: {
            name: call.name,
            arguments: call.arguments
          }
        }))
      };
    }

    if (message.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: message.tool_call_id ?? '',
        content: message.content ?? ''
      };
    }

    return {
      role: message.role,
      content: message.content ?? ''
    };
  });
}

/**
 * Maps an OpenAI chat completion into a renderer-safe step result.
 *
 * @param response - OpenAI SDK chat completion result.
 */
function toChatStepResult(response: ChatCompletion): ChatStepResult {
  const message = response.choices[0]?.message;
  if (!message) {
    throw new Error('The model returned an empty response.');
  }

  const toolCalls = message.tool_calls
    ?.filter((call) => call.type === 'function')
    .map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: call.function.arguments
    }));

  return {
    content: typeof message.content === 'string' ? message.content : null,
    ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {})
  };
}

/**
 * Runs one LLM completion step with the Harbor system prompt and tool definitions attached.
 *
 * @param input - Model id and conversation messages from the renderer.
 * @param deps - Optional client factory override for tests.
 * @returns Assistant text and/or tool calls for the renderer to execute.
 */
export async function runChatCompletionStep(
  input: ChatStepInput,
  deps?: RunChatCompletionStepDeps
): Promise<ChatStepResult> {
  const createClient =
    deps?.createClient ?? ((provider) => new LlmClientFactory().factory(provider));

  const modelOption = getAiModelById(input.model);
  if (!modelOption) {
    throw new Error(`Unknown model: ${input.model}`);
  }

  const buildMessages = (stepMessages: ChatStepMessage[]): ChatCompletionMessageParam[] => [
    { role: 'system', content: AI_SYSTEM_PROMPT },
    ...toOpenAiMessages(stepMessages)
  ];

  try {
    const client = createClient(modelOption.provider);
    const request = (messages: ChatCompletionMessageParam[]): Promise<ChatCompletion> =>
      client.chat.completions.create({
        model: modelOption.id,
        messages,
        tools: AI_TOOL_DEFINITIONS
      });

    let response: ChatCompletion;
    try {
      response = await request(buildMessages(input.messages));
    } catch (error) {
      if (!isContextLengthExceeded(error)) {
        throw error;
      }
      response = await request(buildMessages(truncateChatStepMessages(input.messages, true)));
    }

    return toChatStepResult(response);
  } catch (error) {
    throw toChatCompletionError(error);
  }
}
