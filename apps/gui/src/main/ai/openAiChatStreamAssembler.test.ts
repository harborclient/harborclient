import { describe, expect, it, vi } from 'vitest';
import { assembleOpenAiChatStream } from './openAiChatStreamAssembler';

/**
 * Creates an async stream from a fixed chunk sequence.
 *
 * @param chunks - OpenAI-compatible chunks to yield in order.
 * @returns Async iterable used to model the SDK stream.
 */
async function* streamChunks(chunks: unknown[]): AsyncGenerator<unknown> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe('assembleOpenAiChatStream', () => {
  it('emits text in order and returns the matching final content and usage', async () => {
    const onTextDelta = vi.fn();

    const completion = await assembleOpenAiChatStream(
      streamChunks([
        { choices: [{ delta: { content: 'Hel' } }] },
        { choices: [{ delta: { content: 'lo' } }] },
        {
          choices: [],
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 }
        }
      ]),
      { onTextDelta }
    );

    expect(onTextDelta).toHaveBeenCalledTimes(2);
    expect(onTextDelta).toHaveBeenNthCalledWith(1, 'Hel');
    expect(onTextDelta).toHaveBeenNthCalledWith(2, 'lo');
    expect(completion).toEqual({
      result: { content: 'Hello' },
      usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 }
    });
  });

  it('reassembles indexed fragmented tool calls without text', async () => {
    const completion = await assembleOpenAiChatStream(
      streamChunks([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 1,
                    id: 'call_',
                    function: { name: 'get_', arguments: '{"id":' }
                  },
                  {
                    index: 0,
                    id: 'first',
                    function: { name: 'list', arguments: '{}' }
                  }
                ]
              }
            }
          ]
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [{ index: 1, id: 'two', function: { name: 'item', arguments: '42}' } }]
              }
            }
          ]
        }
      ]),
      { onTextDelta: vi.fn() }
    );

    expect(completion.result).toEqual({
      content: null,
      toolCalls: [
        { id: 'first', name: 'list', arguments: '{}' },
        { id: 'call_two', name: 'get_item', arguments: '{"id":42}' }
      ]
    });
  });

  it('keeps providers without usage or optional thought fields text-only', async () => {
    const completion = await assembleOpenAiChatStream(
      streamChunks([
        {
          choices: [{ delta: { content: 'Only supported text', reasoning_content: 'unverified' } }]
        }
      ]),
      { onTextDelta: vi.fn() }
    );

    expect(completion).toEqual({ result: { content: 'Only supported text' } });
  });
});
