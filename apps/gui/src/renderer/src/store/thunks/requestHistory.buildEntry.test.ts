import { describe, expect, it } from 'vitest';
import type { SendRequestInput } from '@harborclient/http';
import type { SendResult } from '@harborclient/http';
import { buildRequestHistoryEntry } from '#/renderer/src/store/thunks/requestHistory';

/**
 * Builds a minimal send input for history capture tests.
 *
 * @param overrides - Fields to merge onto defaults.
 */
function sendInput(overrides: Partial<SendRequestInput> = {}): SendRequestInput {
  return {
    method: 'GET',
    url: 'https://example.com/items',
    headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
    params: [],
    body: '',
    bodyType: 'json',
    sourceRequestId: 42,
    sourceRequestName: 'List items',
    ...overrides
  };
}

/**
 * Builds a minimal send result for history capture tests.
 *
 * @param overrides - Fields to merge onto defaults.
 */
function sendResult(overrides: Partial<SendResult> = {}): SendResult {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json', 'x-request-id': 'abc' },
    body: '{"items":[]}',
    timeMs: 10,
    sizeBytes: 12,
    ...overrides
  };
}

describe('buildRequestHistoryEntry', () => {
  it('stores response headers and body for text responses', () => {
    const entry = buildRequestHistoryEntry(sendInput(), sendResult());

    expect(entry.responseHeaders).toEqual({
      'content-type': 'application/json',
      'x-request-id': 'abc'
    });
    expect(entry.responseBody).toBe('{"items":[]}');
    expect(entry.savedRequestId).toBe(42);
    expect(entry.name).toBe('List items');
  });

  it('omits responseBody for image responses while keeping response headers', () => {
    const entry = buildRequestHistoryEntry(
      sendInput(),
      sendResult({
        headers: { 'content-type': 'image/png' },
        body: '',
        bodyBase64: 'aaaa'
      })
    );

    expect(entry.responseHeaders).toEqual({ 'content-type': 'image/png' });
    expect(entry.responseBody).toBeUndefined();
  });

  it('omits responseBody for non-image binary responses while keeping response headers', () => {
    const entry = buildRequestHistoryEntry(
      sendInput(),
      sendResult({
        headers: { 'content-type': 'application/pdf' },
        body: '%PDF',
        bodyBase64: 'JVBERi0='
      })
    );

    expect(entry.responseHeaders).toEqual({ 'content-type': 'application/pdf' });
    expect(entry.responseBody).toBeUndefined();
  });
});
