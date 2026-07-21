import { describe, expect, it, vi } from 'vitest';
import { APIError, type OpenAI } from 'openai';
import { extractAssistantContent, runChatCompletionStep } from './completeChatTurn';
import { AGGRESSIVE_HISTORY_MESSAGE_COUNT } from '#/shared/ai/chatContext';
import { AI_SYSTEM_PROMPT, AI_TOOL_DEFINITIONS } from '#/shared/ai/tools';

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
