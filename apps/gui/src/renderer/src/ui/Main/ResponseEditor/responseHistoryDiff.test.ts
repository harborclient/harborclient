import { describe, expect, it } from 'vitest';
import type { RequestHistoryEntry } from '@harborclient/core/types/requestHistory';
import type { SendResult } from '@harborclient/http';
import {
  buildResponseDiffContent,
  canDiffResponse,
  formatResponseHeadersForDiff,
  isSameRequestHistoryEntry,
  priorResponseHistoryForDiff
} from './responseHistoryDiff';

/**
 * Builds a minimal history entry for Diff helper tests.
 *
 * @param overrides - Fields to merge onto defaults.
 */
function historyEntry(overrides: Partial<RequestHistoryEntry> = {}): RequestHistoryEntry {
  return {
    id: 1,
    method: 'GET',
    url: 'https://example.com/items',
    status: 200,
    statusText: 'OK',
    ts: 1_000,
    responseHeaders: { 'content-type': 'application/json' },
    responseBody: '{"ok":true}',
    ...overrides
  };
}

/**
 * Builds a minimal send result for Diff enablement tests.
 *
 * @param overrides - Fields to merge onto defaults.
 */
function sendResult(overrides: Partial<SendResult> = {}): SendResult {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"ok":true}',
    timeMs: 12,
    sizeBytes: 11,
    ...overrides
  };
}

describe('responseHistoryDiff', () => {
  it('matches by savedRequestId when both sides have one', () => {
    expect(
      isSameRequestHistoryEntry(historyEntry({ savedRequestId: 7, url: '/other' }), {
        savedRequestId: 7,
        method: 'POST',
        url: '/ignored'
      })
    ).toBe(true);
  });

  it('matches by method and URL when savedRequestId is unavailable', () => {
    expect(
      isSameRequestHistoryEntry(historyEntry({ method: 'POST', url: 'https://example.com/a' }), {
        method: 'post',
        url: 'https://example.com/a'
      })
    ).toBe(true);
    expect(
      isSameRequestHistoryEntry(historyEntry({ method: 'GET', url: 'https://example.com/a' }), {
        method: 'POST',
        url: 'https://example.com/a'
      })
    ).toBe(false);
  });

  it('ignores collection run entries', () => {
    expect(
      isSameRequestHistoryEntry(historyEntry({ kind: 'run', savedRequestId: 1 }), {
        savedRequestId: 1,
        method: 'GET',
        url: 'https://example.com/items'
      })
    ).toBe(false);
  });

  it('excludes the newest matching entry and older rows without response capture', () => {
    const history = [
      historyEntry({ id: 3, ts: 3_000, responseBody: '{"v":3}' }),
      historyEntry({ id: 2, ts: 2_000, responseBody: undefined, responseHeaders: undefined }),
      historyEntry({ id: 1, ts: 1_000, responseBody: '{"v":1}' })
    ];

    expect(
      priorResponseHistoryForDiff(
        history,
        { method: 'GET', url: 'https://example.com/items' },
        'body'
      ).map((entry) => entry.id)
    ).toEqual([1]);
  });

  it('requires responseBody only for body Diff', () => {
    const history = [
      historyEntry({ id: 2, ts: 2_000, responseBody: undefined }),
      historyEntry({ id: 1, ts: 1_000, responseBody: undefined })
    ];

    expect(
      priorResponseHistoryForDiff(
        history,
        { method: 'GET', url: 'https://example.com/items' },
        'headers'
      ).map((entry) => entry.id)
    ).toEqual([1]);

    expect(
      priorResponseHistoryForDiff(
        history,
        { method: 'GET', url: 'https://example.com/items' },
        'body'
      )
    ).toEqual([]);
  });

  it('disables Diff when there is no prior history or the response is an image', () => {
    const prior = [historyEntry({ id: 1 })];
    expect(canDiffResponse(sendResult(), prior)).toBe(true);
    expect(canDiffResponse(sendResult(), [])).toBe(false);
    expect(
      canDiffResponse(sendResult({ headers: { 'content-type': 'image/png' }, body: '' }), prior)
    ).toBe(false);
  });

  it('serializes headers with sorted keys for stable Diffs', () => {
    expect(
      formatResponseHeadersForDiff({
        'X-B': '2',
        'content-type': 'application/json',
        'X-A': '1'
      })
    ).toBe('content-type: application/json\nX-A: 1\nX-B: 2');
  });

  it('returns null Diff content when no baseline is selected', () => {
    expect(buildResponseDiffContent('body', sendResult(), null)).toBeNull();
  });

  it('builds sorted header Diff documents for a baseline entry', () => {
    const content = buildResponseDiffContent(
      'headers',
      sendResult({
        headers: { 'content-type': 'application/json', 'x-new': '1' }
      }),
      historyEntry({
        responseHeaders: { 'content-type': 'application/json', 'x-old': '0' }
      })
    );

    expect(content).toEqual({
      title: 'Headers diff',
      previous: 'content-type: application/json\nx-old: 0',
      current: 'content-type: application/json\nx-new: 1',
      language: 'text'
    });
  });

  it('builds pretty-printed body Diff documents with JSON language', () => {
    const content = buildResponseDiffContent(
      'body',
      sendResult({ body: '{"ok":false}', headers: { 'content-type': 'application/json' } }),
      historyEntry({ responseBody: '{"ok":true}' })
    );

    expect(content).toEqual({
      title: 'Body diff',
      previous: '{\n  "ok": true\n}',
      current: '{\n  "ok": false\n}',
      language: 'json'
    });
  });

  it('uses empty-body placeholders when body Diff sides are blank', () => {
    const content = buildResponseDiffContent(
      'body',
      sendResult({ body: '', headers: { 'content-type': 'text/plain' } }),
      historyEntry({ responseBody: '' })
    );

    expect(content).toEqual({
      title: 'Body diff',
      previous: '(empty body)',
      current: '(empty body)',
      language: 'text'
    });
  });
});
