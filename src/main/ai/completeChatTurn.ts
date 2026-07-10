import { APIError, type OpenAI } from 'openai';
import type { ChatCompletion, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { LlmClientFactory } from '#/main/ai/LlmClientFactory';
import { runHubChatCompletionStep } from '#/main/ai/hubChatStep';
import { logVerbose } from '#/main/logger';
import { mergeMcpClientTools } from '#/main/mcp/mergeMcpClientTools';
import { truncateChatStepMessages } from '#/shared/ai/chatContext';
import { resolveChatStepMode } from '#/shared/ai/chatStepMode';
import { getAiModelById } from '#/shared/ai/models';
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
 * Returns whether an error represents a user-initiated request abort.
 *
 * @param error - Error thrown by fetch or the OpenAI SDK.
 */
function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

/**
 * Normalizes LLM client failures into user-facing errors.
 *
 * @param error - Error thrown by the OpenAI SDK or local validation.
 */
function toChatCompletionError(error: unknown): Error {
  if (isAbortError(error)) {
    return error instanceof Error ? error : new DOMException('Chat step aborted.', 'AbortError');
  }
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
 * Logs each tool call's name and arguments in verbose mode (`-v`) so tool
 * usage can be inspected in the terminal without opening DevTools.
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

  if (toolCalls && toolCalls.length > 0) {
    for (const call of toolCalls) {
      logVerbose('[ai-tool-call]', call.name, call.arguments);
    }
  }

  return {
    content: typeof message.content === 'string' ? message.content : null,
    ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {})
  };
}

/**
 * Optional runtime controls for one LLM completion step.
 */
export interface RunChatCompletionStepOptions {
  /**
   * Aborts the in-flight provider request when the user stops generation.
   */
  signal?: AbortSignal;
}

/**
 * Runs one LLM completion step with the HarborClient system prompt and tool definitions attached.
 *
 * @param input - Model id and conversation messages from the renderer.
 * @param deps - Optional client factory override for tests.
 * @param options - Optional abort signal for user cancellation.
 * @returns Assistant text and/or tool calls for the renderer to execute.
 */
export async function runChatCompletionStep(
  input: ChatStepInput,
  deps?: RunChatCompletionStepDeps,
  options?: RunChatCompletionStepOptions
): Promise<ChatStepResult> {
  if (input.hubId?.trim()) {
    return runHubChatCompletionStep(input, options);
  }

  const createClient =
    deps?.createClient ?? ((provider) => new LlmClientFactory().factory(provider));

  const modelOption = getAiModelById(input.model);
  if (!modelOption) {
    throw new Error(`Unknown model: ${input.model}`);
  }

  const stepMode = resolveChatStepMode(input);
  const tools = mergeMcpClientTools(stepMode);
  const toolChoice = stepMode.toolChoice;

  const buildMessages = (stepMessages: ChatStepMessage[]): ChatCompletionMessageParam[] => [
    {
      role: 'system',
      content: stepMode.systemPrompt
    },
    ...toOpenAiMessages(stepMessages)
  ];

  try {
    const client = createClient(modelOption.provider);
    const request = (messages: ChatCompletionMessageParam[]): Promise<ChatCompletion> =>
      client.chat.completions.create({
        model: modelOption.id,
        messages,
        tools,
        ...(toolChoice ? { tool_choice: toolChoice } : {}),
        ...(options?.signal ? { signal: options.signal } : {})
      });

    let response: ChatCompletion;
    try {
      response = await request(buildMessages(stepMode.messages));
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      if (!isContextLengthExceeded(error) || stepMode.toolChoice) {
        throw error;
      }
      response = await request(buildMessages(truncateChatStepMessages(stepMode.messages, true)));
    }

    return toChatStepResult(response);
  } catch (error) {
    throw toChatCompletionError(error);
  }
}
