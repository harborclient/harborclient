import { APIError, type OpenAI } from 'openai';
import type { ChatCompletion, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { LlmClientFactory } from './LlmClientFactory';
import { runHubChatCompletionStep } from './hubChatStep';
import {
  assembleOpenAiChatStream,
  type AssembledOpenAiChatCompletion
} from './openAiChatStreamAssembler';
import { pushAiChatStreamMessage } from './pushAiChatStreamMessage';
import { logVerbose } from '#/main/logger';
import { mergeMcpClientTools } from '#/main/mcp/mergeMcpClientTools';
import { truncateChatStepMessages } from '@harborclient/core/ai/chatContext';
import { resolveChatStepMode } from '@harborclient/core/ai/chatStepMode';
import { getAiModelById } from '@harborclient/core/ai/models';
import type {
  AiChatStreamContext,
  ChatStepInput,
  ChatStepMessage,
  ChatStepResult,
  LlmProvider
} from '@harborclient/core/types';

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
  createClient: (provider: LlmProvider) => Promise<OpenAI>;
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

  /**
   * Validated desktop routing metadata that enables normal sidebar streaming.
   */
  streamContext?: AiChatStreamContext;
}

/**
 * Returns whether this call is the normal sidebar agent path, the only direct
 * provider path whose incremental output is safe to deliver to the chat UI.
 *
 * @param input - Completion input being routed.
 * @returns True for ordinary sidebar agent calls without an auxiliary mode.
 */
function isNormalSidebarAgentTurn(input: ChatStepInput): boolean {
  return (
    !input.hubId?.trim() && !input.scriptAsk && !input.chatTitlePrompt && input.agentVariant == null
  );
}

/**
 * Returns a bounded user-facing message for a terminal stream failure.
 *
 * @param error - Error thrown by the SDK stream.
 * @returns Safe message suitable for the validated stream event payload.
 */
function toStreamErrorMessage(error: unknown): string {
  const message = toChatCompletionError(error).message;
  return message.slice(0, 4_096) || 'Failed to get a response from the model.';
}

/**
 * Runs one direct-provider completion as a normalized desktop stream.
 *
 * A context-length retry is permitted only before a visible text delta; the
 * stream start marker is retained across retries so the renderer sees one step.
 *
 * @param client - OpenAI-compatible SDK client.
 * @param input - Original model input.
 * @param messages - Provider-formatted completion messages.
 * @param tools - Resolved tools for the normal sidebar agent.
 * @param toolChoice - Optional tool-choice constraint.
 * @param options - Signal and validated desktop stream context.
 * @returns Final result that remains compatible with invoke-based callers.
 */
async function runDirectChatCompletionStream(
  client: OpenAI,
  input: ChatStepInput,
  messages: ChatCompletionMessageParam[],
  tools: ReturnType<typeof mergeMcpClientTools>,
  toolChoice: ReturnType<typeof resolveChatStepMode>['toolChoice'],
  options: RunChatCompletionStepOptions & { streamContext: AiChatStreamContext }
): Promise<ChatStepResult> {
  const { streamContext } = options;
  let emittedStepStart = false;
  let emittedTextDelta = false;
  let emittedTerminal = false;

  /**
   * Delivers an event with the validated desktop correlation fields attached.
   *
   * @param event - Normalized event body for this completion step.
   */
  const emit = (event: Parameters<typeof pushAiChatStreamMessage>[1]): void => {
    pushAiChatStreamMessage(streamContext.chatId, event);
  };

  /**
   * Emits one terminal event, protecting against SDK errors raised during
   * iterator cleanup after an earlier terminal outcome.
   *
   * @param event - Normalized terminal event for this turn.
   */
  const emitTerminal = (
    event:
      | { v: 1; type: 'turn.error'; turnId: string; message: string }
      | { v: 1; type: 'turn.cancelled'; turnId: string }
  ): void => {
    if (emittedTerminal) {
      return;
    }
    emittedTerminal = true;
    emit(event);
  };

  /**
   * Creates a stream request for one message history attempt.
   *
   * @param requestMessages - System and conversation messages to send.
   * @returns SDK async iterator of OpenAI-compatible chunks.
   */
  const request = async (
    requestMessages: ChatCompletionMessageParam[]
  ): Promise<AsyncIterable<unknown>> =>
    await client.chat.completions.create(
      {
        model: input.model,
        messages: requestMessages,
        tools,
        stream: true,
        stream_options: { include_usage: true },
        ...(toolChoice ? { tool_choice: toolChoice } : {})
      },
      options.signal ? { signal: options.signal } : undefined
    );

  /**
   * Consumes one provider stream attempt, sending start/text events in order.
   *
   * @param requestMessages - System and conversation messages to stream.
   * @returns Assembled final completion.
   */
  const consume = async (
    requestMessages: ChatCompletionMessageParam[]
  ): Promise<AssembledOpenAiChatCompletion> =>
    assembleOpenAiChatStream(await request(requestMessages), {
      onTextDelta: (chunk) => {
        if (!emittedStepStart) {
          emittedStepStart = true;
          emit({
            v: 1,
            type: 'step.start',
            turnId: streamContext.turnId,
            stepIndex: streamContext.stepIndex
          });
        }
        emittedTextDelta = true;
        emit({
          v: 1,
          type: 'delta.text',
          turnId: streamContext.turnId,
          stepIndex: streamContext.stepIndex,
          chunk
        });
      }
    });

  try {
    let completion;
    try {
      completion = await consume(messages);
    } catch (error) {
      if (
        isAbortError(error) ||
        emittedTextDelta ||
        !isContextLengthExceeded(error) ||
        toolChoice
      ) {
        throw error;
      }
      completion = await consume([
        messages[0]!,
        ...toOpenAiMessages(truncateChatStepMessages(input.messages, true))
      ]);
    }

    if (options.signal?.aborted) {
      throw new DOMException('Chat step aborted.', 'AbortError');
    }

    if (!emittedStepStart) {
      emittedStepStart = true;
      emit({
        v: 1,
        type: 'step.start',
        turnId: streamContext.turnId,
        stepIndex: streamContext.stepIndex
      });
    }
    for (const call of completion.result.toolCalls ?? []) {
      logVerbose('[ai-tool-call]', call.name, call.arguments);
      emit({
        v: 1,
        type: 'tool.call',
        turnId: streamContext.turnId,
        stepIndex: streamContext.stepIndex,
        callId: call.id,
        name: call.name,
        owner: 'harbor',
        arguments: call.arguments
      });
    }
    emit({
      v: 1,
      type: 'step.end',
      turnId: streamContext.turnId,
      stepIndex: streamContext.stepIndex,
      content: completion.result.content,
      ...(completion.result.toolCalls?.length ? { toolCalls: completion.result.toolCalls } : {}),
      ...(completion.usage ? { usage: completion.usage } : {})
    });
    return completion.result;
  } catch (error) {
    if (isAbortError(error)) {
      emitTerminal({ v: 1, type: 'turn.cancelled', turnId: streamContext.turnId });
      throw error;
    }
    emitTerminal({
      v: 1,
      type: 'turn.error',
      turnId: streamContext.turnId,
      message: toStreamErrorMessage(error)
    });
    throw toChatCompletionError(error);
  }
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
    const client = await createClient(modelOption.provider);
    if (options?.streamContext && isNormalSidebarAgentTurn(input)) {
      return await runDirectChatCompletionStream(
        client,
        input,
        buildMessages(stepMode.messages),
        tools,
        toolChoice,
        { ...options, streamContext: options.streamContext }
      );
    }

    const request = (messages: ChatCompletionMessageParam[]): Promise<ChatCompletion> =>
      client.chat.completions.create(
        {
          model: modelOption.id,
          messages,
          tools,
          ...(toolChoice ? { tool_choice: toolChoice } : {})
        },
        options?.signal ? { signal: options.signal } : undefined
      );

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
