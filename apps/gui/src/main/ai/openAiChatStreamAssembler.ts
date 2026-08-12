import type { AiChatStreamUsage, ChatStepResult, ChatToolCall } from '@harborclient/core/types';

/**
 * The OpenAI-compatible subset consumed by the direct-provider stream path.
 *
 * Providers may add fields to chunks, but only these standard Chat Completions
 * fields are normalized into renderer events.
 */
interface OpenAiCompatibleChatCompletionChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
}

/**
 * Incrementally reconstructed fields for one function call.
 */
interface PartialToolCall {
  /**
   * Provider call identifier, typically sent in the first fragment.
   */
  id: string;

  /**
   * Function name, typically sent in the first fragment.
   */
  name: string;

  /**
   * Concatenated JSON argument fragments.
   */
  arguments: string;
}

/**
 * Final normalized completion data derived from an OpenAI-compatible stream.
 */
export interface AssembledOpenAiChatCompletion {
  /**
   * Result returned to the existing renderer tool loop.
   */
  result: ChatStepResult;

  /**
   * Token usage reported in the terminal stream chunk, when available.
   */
  usage?: AiChatStreamUsage;
}

/**
 * Event hooks invoked as standard OpenAI-compatible data becomes available.
 */
export interface OpenAiChatStreamAssemblerOptions {
  /**
   * Receives incremental assistant text in arrival order.
   *
   * No provider-specific reasoning fields are read here because none have a
   * fixture-proven contract across the installed compatible providers.
   */
  onTextDelta: (chunk: string) => void;
}

/**
 * Converts provider usage names into the canonical renderer-safe shape.
 *
 * @param usage - Optional token counters from a terminal stream chunk.
 * @returns Canonical usage when at least one finite counter is available.
 */
function toStreamUsage(
  usage: OpenAiCompatibleChatCompletionChunk['usage']
): AiChatStreamUsage | undefined {
  if (!usage) {
    return undefined;
  }

  const result: AiChatStreamUsage = {};
  if (
    typeof usage.prompt_tokens === 'number' &&
    Number.isFinite(usage.prompt_tokens) &&
    usage.prompt_tokens >= 0
  ) {
    result.promptTokens = usage.prompt_tokens;
  }
  if (
    typeof usage.completion_tokens === 'number' &&
    Number.isFinite(usage.completion_tokens) &&
    usage.completion_tokens >= 0
  ) {
    result.completionTokens = usage.completion_tokens;
  }
  if (
    typeof usage.total_tokens === 'number' &&
    Number.isFinite(usage.total_tokens) &&
    usage.total_tokens >= 0
  ) {
    result.totalTokens = usage.total_tokens;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Builds executable tool calls only after all index-addressed fragments arrive.
 *
 * @param calls - Partially reconstructed calls indexed by provider stream position.
 * @returns Complete renderer tool calls in provider index order.
 * @throws Error when the provider terminates a tool call without required fields.
 */
function finalizeToolCalls(calls: Map<number, PartialToolCall>): ChatToolCall[] | undefined {
  if (calls.size === 0) {
    return undefined;
  }

  return [...calls.entries()]
    .sort(([left], [right]) => left - right)
    .map(([index, call]) => {
      if (!call.id || !call.name) {
        throw new Error(`The model returned an incomplete tool call at index ${index}.`);
      }

      return call;
    });
}

/**
 * Consumes an OpenAI-compatible Chat Completions stream into the existing
 * `ChatStepResult`, emitting only normalized standard text while it arrives.
 *
 * @param stream - SDK async iterator returned by `stream: true`.
 * @param options - Incremental normalized event hooks.
 * @returns Final tool-loop result and optional terminal usage metadata.
 */
export async function assembleOpenAiChatStream(
  stream: AsyncIterable<unknown>,
  options: OpenAiChatStreamAssemblerOptions
): Promise<AssembledOpenAiChatCompletion> {
  let content = '';
  let usage: AiChatStreamUsage | undefined;
  const toolCalls = new Map<number, PartialToolCall>();

  for await (const value of stream) {
    const chunk = value as OpenAiCompatibleChatCompletionChunk;
    const chunkUsage = toStreamUsage(chunk.usage);
    if (chunkUsage) {
      usage = chunkUsage;
    }

    for (const choice of chunk.choices ?? []) {
      const delta = choice.delta;
      if (!delta) {
        continue;
      }

      if (typeof delta.content === 'string' && delta.content.length > 0) {
        content += delta.content;
        options.onTextDelta(delta.content);
      }

      for (const toolCall of delta.tool_calls ?? []) {
        const index = toolCall.index ?? 0;
        const existing = toolCalls.get(index) ?? { id: '', name: '', arguments: '' };
        if (typeof toolCall.id === 'string') {
          existing.id += toolCall.id;
        }
        if (typeof toolCall.function?.name === 'string') {
          existing.name += toolCall.function.name;
        }
        if (typeof toolCall.function?.arguments === 'string') {
          existing.arguments += toolCall.function.arguments;
        }
        toolCalls.set(index, existing);
      }
    }
  }

  const completedToolCalls = finalizeToolCalls(toolCalls);
  return {
    result: {
      content: content || null,
      ...(completedToolCalls?.length ? { toolCalls: completedToolCalls } : {})
    },
    ...(usage ? { usage } : {})
  };
}
