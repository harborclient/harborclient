import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError, type OpenAI } from 'openai';
import { extractAssistantContent, runChatCompletionStep } from './completeChatTurn';
import { AGGRESSIVE_HISTORY_MESSAGE_COUNT } from '@harborclient/core/ai/chatContext';
import { AI_SYSTEM_PROMPT, AI_TOOL_DEFINITIONS } from '@harborclient/core/ai/tools';

const { pushAiChatStreamMessage } = vi.hoisted(() => ({
  pushAiChatStreamMessage: vi.fn()
}));

vi.mock('./pushAiChatStreamMessage', () => ({ pushAiChatStreamMessage }));

/**
 * Builds an OpenAI context length error for retry tests.
 */
function contextLengthError(): APIError {
  return new APIError(
    400,
    { code: 'context_length_exceeded', message: 'context length exceeded' },
    'context length exceeded',
    new Headers()
  );
}

/**
 * Creates an async OpenAI-compatible stream from a fixed chunk sequence.
 *
 * @param chunks - Chunks to yield in order.
 * @returns SDK-like async iterable.
 */
async function* streamChunks(chunks: unknown[]): AsyncGenerator<unknown> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

/**
 * Creates a stream that optionally yields once before failing.
 *
 * @param error - Failure raised while iterating the stream.
 * @param firstChunk - Optional chunk delivered before the failure.
 * @returns Failing SDK-like async iterable.
 */
async function* failingStream(error: Error, firstChunk?: unknown): AsyncGenerator<unknown> {
  if (firstChunk !== undefined) {
    yield firstChunk;
  }
  throw error;
}

/**
 * Clears stream-delivery assertions between independent completion scenarios.
 */
beforeEach(() => {
  pushAiChatStreamMessage.mockClear();
});

describe('extractAssistantContent', () => {
  it('returns string content from the first choice', () => {
    expect(
      extractAssistantContent({
        choices: [{ message: { role: 'assistant', content: 'Hello' } }]
      } as Parameters<typeof extractAssistantContent>[0])
    ).toBe('Hello');
  });

  it('returns null when the model returns no content', () => {
    expect(
      extractAssistantContent({
        choices: [{ message: { role: 'assistant', content: null } }]
      } as Parameters<typeof extractAssistantContent>[0])
    ).toBeNull();
  });
});

describe('runChatCompletionStep', () => {
  it('streams normal sidebar text and returns the same final result', async () => {
    const create = vi
      .fn()
      .mockReturnValue(
        streamChunks([
          { choices: [{ delta: { content: 'Hello ' } }] },
          { choices: [{ delta: { content: 'there' } }] },
          { choices: [], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } }
        ])
      );
    const mockClient = {
      chat: {
        completions: {
          create
        }
      }
    } as unknown as OpenAI;

    const result = await runChatCompletionStep(
      { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] },
      { createClient: async () => mockClient },
      { streamContext: { chatId: 4, turnId: 'turn-1', stepIndex: 0 } }
    );

    expect(result).toEqual({ content: 'Hello there' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true, stream_options: { include_usage: true } }),
      undefined
    );
    expect(pushAiChatStreamMessage).toHaveBeenNthCalledWith(1, 4, {
      v: 1,
      type: 'step.start',
      turnId: 'turn-1',
      stepIndex: 0
    });
    expect(pushAiChatStreamMessage).toHaveBeenNthCalledWith(2, 4, {
      v: 1,
      type: 'delta.text',
      turnId: 'turn-1',
      stepIndex: 0,
      chunk: 'Hello '
    });
    expect(pushAiChatStreamMessage).toHaveBeenLastCalledWith(4, {
      v: 1,
      type: 'step.end',
      turnId: 'turn-1',
      stepIndex: 0,
      content: 'Hello there',
      usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 }
    });
  });

  it('emits completed fragmented tool calls after stream assembly', async () => {
    const create = vi.fn().mockReturnValue(
      streamChunks([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: 'call_', function: { name: 'get_', arguments: '{"a":' } }
                ]
              }
            }
          ]
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [{ index: 0, id: '1', function: { name: 'thing', arguments: '1}' } }]
              }
            }
          ]
        }
      ])
    );
    const mockClient = {
      chat: {
        completions: {
          create
        }
      }
    } as unknown as OpenAI;

    const result = await runChatCompletionStep(
      { model: 'gpt-4o', messages: [{ role: 'user', content: 'Use a tool' }] },
      { createClient: async () => mockClient },
      { streamContext: { chatId: 4, turnId: 'turn-1', stepIndex: 2 } }
    );

    const toolCall = { id: 'call_1', name: 'get_thing', arguments: '{"a":1}' };
    expect(result).toEqual({ content: null, toolCalls: [toolCall] });
    expect(pushAiChatStreamMessage).toHaveBeenNthCalledWith(2, 4, {
      v: 1,
      type: 'tool.call',
      turnId: 'turn-1',
      stepIndex: 2,
      callId: 'call_1',
      name: 'get_thing',
      owner: 'harbor',
      arguments: '{"a":1}'
    });
  });

  it('does not stream auxiliary completion modes when stream context is supplied', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { role: 'assistant', content: 'A title' } }]
    });
    const mockClient = {
      chat: {
        completions: {
          create
        }
      }
    } as unknown as OpenAI;

    await runChatCompletionStep(
      {
        model: 'gpt-4o',
        messages: [],
        chatTitlePrompt: 'Create a title'
      },
      { createClient: async () => mockClient },
      { streamContext: { chatId: 4, turnId: 'turn-1', stepIndex: 0 } }
    );

    expect(create).toHaveBeenCalledWith(expect.not.objectContaining({ stream: true }), undefined);
    expect(pushAiChatStreamMessage).not.toHaveBeenCalled();
  });

  it('retries a context overflow before visible output without replaying a step start', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(contextLengthError())
      .mockReturnValueOnce(streamChunks([{ choices: [{ delta: { content: 'Recovered' } }] }]));
    const mockClient = {
      chat: {
        completions: {
          create
        }
      }
    } as unknown as OpenAI;

    await expect(
      runChatCompletionStep(
        {
          model: 'gpt-4o',
          messages: Array.from({ length: 10 }, (_, index) => ({
            role: 'user' as const,
            content: `message-${index}`
          }))
        },
        { createClient: async () => mockClient },
        { streamContext: { chatId: 4, turnId: 'turn-1', stepIndex: 0 } }
      )
    ).resolves.toEqual({ content: 'Recovered' });

    expect(create).toHaveBeenCalledTimes(2);
    expect(pushAiChatStreamMessage).toHaveBeenCalledTimes(3);
    expect(pushAiChatStreamMessage).toHaveBeenNthCalledWith(1, 4, {
      v: 1,
      type: 'step.start',
      turnId: 'turn-1',
      stepIndex: 0
    });
  });

  it('emits one terminal error when a stream fails after text', async () => {
    const create = vi.fn().mockReturnValue(
      failingStream(new Error('provider disconnected'), {
        choices: [{ delta: { content: 'Partial' } }]
      })
    );
    const mockClient = {
      chat: {
        completions: {
          create
        }
      }
    } as unknown as OpenAI;

    await expect(
      runChatCompletionStep(
        { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] },
        { createClient: async () => mockClient },
        { streamContext: { chatId: 4, turnId: 'turn-1', stepIndex: 0 } }
      )
    ).rejects.toThrow('provider disconnected');

    expect(pushAiChatStreamMessage).toHaveBeenLastCalledWith(4, {
      v: 1,
      type: 'turn.error',
      turnId: 'turn-1',
      message: 'provider disconnected'
    });
  });

  it('emits cancellation and preserves AbortError from a stream', async () => {
    const create = vi
      .fn()
      .mockReturnValue(failingStream(new DOMException('Chat step aborted.', 'AbortError')));
    const mockClient = {
      chat: {
        completions: {
          create
        }
      }
    } as unknown as OpenAI;

    await expect(
      runChatCompletionStep(
        { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] },
        { createClient: async () => mockClient },
        { streamContext: { chatId: 4, turnId: 'turn-1', stepIndex: 0 } }
      )
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(pushAiChatStreamMessage).toHaveBeenCalledWith(4, {
      v: 1,
      type: 'turn.cancelled',
      turnId: 'turn-1'
    });
  });

  it('prepends the system prompt, attaches tools, and returns tool calls', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'list_collections', arguments: '{}' }
              }
            ]
          }
        }
      ]
    });
    const mockClient = {
      chat: {
        completions: {
          create
        }
      }
    } as unknown as OpenAI;

    const result = await runChatCompletionStep(
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'What collections do I have?' }]
      },
      { createClient: async () => mockClient }
    );

    expect(create).toHaveBeenCalledWith(
      {
        model: 'gpt-4o',
        tools: AI_TOOL_DEFINITIONS,
        messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          { role: 'user', content: 'What collections do I have?' }
        ]
      },
      undefined
    );
    expect(result.toolCalls).toEqual([{ id: 'call_1', name: 'list_collections', arguments: '{}' }]);
  });

  it('forwards an abort signal to the OpenAI SDK request', async () => {
    const controller = new AbortController();
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { role: 'assistant', content: 'Done.' } }]
    });
    const mockClient = {
      chat: {
        completions: {
          create
        }
      }
    } as unknown as OpenAI;

    await runChatCompletionStep(
      { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] },
      { createClient: async () => mockClient },
      { signal: controller.signal }
    );

    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({ signal: controller.signal }),
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it('rethrows AbortError without wrapping it', async () => {
    const create = vi.fn().mockRejectedValue(new DOMException('Chat step aborted.', 'AbortError'));
    const mockClient = {
      chat: {
        completions: {
          create
        }
      }
    } as unknown as OpenAI;

    await expect(
      runChatCompletionStep(
        { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] },
        { createClient: async () => mockClient }
      )
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('returns assistant text when no tool calls are present', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { role: 'assistant', content: 'Done.' } }]
    });
    const mockClient = {
      chat: {
        completions: {
          create
        }
      }
    } as unknown as OpenAI;

    const result = await runChatCompletionStep(
      { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] },
      { createClient: async () => mockClient }
    );

    expect(result).toEqual({ content: 'Done.' });
  });

  it('retries once with aggressive truncation after context_length_exceeded', async () => {
    const longMessages = Array.from({ length: 10 }, (_, index) => ({
      role: 'user' as const,
      content: `message-${index}`
    }));
    const create = vi
      .fn()
      .mockRejectedValueOnce(contextLengthError())
      .mockResolvedValueOnce({
        choices: [{ message: { role: 'assistant', content: 'Recovered.' } }]
      });
    const mockClient = {
      chat: {
        completions: {
          create
        }
      }
    } as unknown as OpenAI;

    const result = await runChatCompletionStep(
      { model: 'gpt-4o', messages: longMessages },
      { createClient: async () => mockClient }
    );

    expect(create).toHaveBeenCalledTimes(2);
    const retryMessages = create.mock.calls[1]?.[0]?.messages ?? [];
    expect(retryMessages).toHaveLength(AGGRESSIVE_HISTORY_MESSAGE_COUNT + 1);
    expect(result).toEqual({ content: 'Recovered.' });
  });

  it('returns a friendly error when retry also exceeds context length', async () => {
    const create = vi.fn().mockRejectedValue(contextLengthError());
    const mockClient = {
      chat: {
        completions: {
          create
        }
      }
    } as unknown as OpenAI;

    await expect(
      runChatCompletionStep(
        { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] },
        { createClient: async () => mockClient }
      )
    ).rejects.toThrow(
      'The conversation is too long for this model. Start a new chat or ask about a smaller response.'
    );
    expect(create).toHaveBeenCalledTimes(2);
  });
});
