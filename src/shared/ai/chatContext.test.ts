import { describe, expect, it } from 'vitest';
import {
  AGGRESSIVE_HISTORY_MESSAGE_COUNT,
  AGGRESSIVE_MESSAGE_CONTENT_CHARS,
  DEFAULT_QUERY_RESULT_CHARS,
  DEFAULT_RESPONSE_BODY_CHARS,
  RESPONSE_BODY_PREVIEW_CHARS,
  formatHttpResponseForAgent,
  queryJsonForAgent,
  truncateChatStepMessages,
  truncateTextForLlm
} from '#/shared/ai/chatContext';
import type { ChatStepMessage, SendResult } from '#/shared/types';

/**
 * Builds a minimal send result for formatting tests.
 *
 * @param body - Response body text.
 */
function sampleSendResult(body: string): SendResult {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body,
    timeMs: 42,
    sizeBytes: body.length
  };
}

describe('truncateTextForLlm', () => {
  it('returns the original text when under the limit', () => {
    expect(truncateTextForLlm('hello', 10)).toEqual({
      text: 'hello',
      truncated: false,
      originalLength: 5
    });
  });

  it('truncates text and reports metadata when over the limit', () => {
    expect(truncateTextForLlm('abcdef', 3)).toEqual({
      text: 'abc',
      truncated: true,
      originalLength: 6
    });
  });

  it('returns empty text when maxChars is zero', () => {
    expect(truncateTextForLlm('hello', 0)).toEqual({
      text: '',
      truncated: true,
      originalLength: 5
    });
  });
});

describe('formatHttpResponseForAgent', () => {
  it('returns a summary with a capped body preview', () => {
    const body = 'x'.repeat(RESPONSE_BODY_PREVIEW_CHARS + 100);
    const result = formatHttpResponseForAgent(sampleSendResult(body), [], { mode: 'summary' });

    expect(result.bodyPreview).toHaveLength(RESPONSE_BODY_PREVIEW_CHARS);
    expect(result.bodyPreviewTruncated).toBe(true);
    expect(result.bodyOriginalLength).toBe(body.length);
    expect(result.body).toBeUndefined();
  });

  it('includes a truncated full body when maxBodyChars is set', () => {
    const body = 'y'.repeat(DEFAULT_RESPONSE_BODY_CHARS + 50);
    const result = formatHttpResponseForAgent(sampleSendResult(body), [], {
      maxBodyChars: 1000
    });

    expect(result.body).toHaveLength(1000);
    expect(result.bodyTruncated).toBe(true);
    expect(result.bodyOriginalLength).toBe(body.length);
    expect(result.bodyPreview).toHaveLength(RESPONSE_BODY_PREVIEW_CHARS);
  });

  it('preserves status, headers, timing, and tests', () => {
    const result = formatHttpResponseForAgent(
      sampleSendResult('ok'),
      [{ name: 'pass', passed: true }],
      {
        mode: 'summary'
      }
    );

    expect(result.status).toBe(200);
    expect(result.headers).toEqual({ 'content-type': 'application/json' });
    expect(result.timeMs).toBe(42);
    expect(result.tests).toEqual([{ name: 'pass', passed: true }]);
  });
});

describe('truncateChatStepMessages', () => {
  it('returns messages unchanged when aggressive is false', () => {
    const messages: ChatStepMessage[] = [{ role: 'user', content: 'hello' }];
    expect(truncateChatStepMessages(messages, false)).toBe(messages);
  });

  it('keeps only the last six messages when aggressive', () => {
    const messages: ChatStepMessage[] = Array.from({ length: 10 }, (_, index) => ({
      role: 'user',
      content: `message-${index}`
    }));

    const result = truncateChatStepMessages(messages, true);

    expect(result).toHaveLength(AGGRESSIVE_HISTORY_MESSAGE_COUNT);
    expect(result[0]?.content).toBe('message-4');
    expect(result.at(-1)?.content).toBe('message-9');
  });

  it('caps long message content when aggressive', () => {
    const longContent = 'z'.repeat(AGGRESSIVE_MESSAGE_CONTENT_CHARS + 500);
    const messages: ChatStepMessage[] = [
      { role: 'tool', content: longContent, tool_call_id: 'call_1' }
    ];

    const result = truncateChatStepMessages(messages, true);

    expect(result[0]?.content).toContain('… [truncated from');
    expect(result[0]?.content?.length).toBeLessThan(longContent.length);
  });
});

describe('queryJsonForAgent', () => {
  const sampleBody = JSON.stringify({
    data: {
      items: [{ id: 1 }, { id: 2 }, { id: 3 }]
    }
  });

  it('returns a numeric result for length expressions', () => {
    const result = queryJsonForAgent(sampleBody, 'length(data.items)');

    expect(result).toEqual({
      expression: 'length(data.items)',
      resultType: 'number',
      result: 3
    });
  });

  it('returns array results with matchCount', () => {
    const result = queryJsonForAgent(sampleBody, 'data.items[*].id');

    expect(result).toEqual({
      expression: 'data.items[*].id',
      resultType: 'array',
      matchCount: 3,
      result: [1, 2, 3]
    });
  });

  it('returns an error when the body is not valid JSON', () => {
    expect(
      queryJsonForAgent('not-json', 'length(@)', DEFAULT_QUERY_RESULT_CHARS, 'text/plain')
    ).toEqual({
      error: 'Response body is not valid JSON.',
      contentType: 'text/plain'
    });
  });

  it('returns an error for invalid JMESPath expressions', () => {
    const result = queryJsonForAgent(sampleBody, 'data.items[');

    expect(result).toEqual({
      error: expect.stringContaining('Invalid JMESPath expression:')
    });
  });

  it('returns a truncated preview when the stringified result is too large', () => {
    const largeItems = Array.from({ length: 500 }, (_, index) => ({
      id: index,
      name: `item-${index}`
    }));
    const body = JSON.stringify({ data: { items: largeItems } });
    const result = queryJsonForAgent(body, 'data.items', 200);

    expect(result).toMatchObject({
      expression: 'data.items',
      resultType: 'array',
      matchCount: 500,
      resultTruncated: true,
      resultOriginalLength: expect.any(Number)
    });
    expect('resultPreview' in result && result.resultPreview).toHaveLength(200);
    expect('result' in result ? result.result : undefined).toBeUndefined();
  });
});
