import { describe, expect, it } from 'vitest';
import type { LiveServerRequestLogEntry } from '@harborclient/core/types';
import { LIVE_SERVER_LOG_BUFFER_MAX, pushLiveServerLog } from './liveServerLogBuffer';

/**
 * Builds a minimal access-log entry for buffer tests.
 *
 * @param index - Distinguishes entries in assertions.
 * @returns Synthetic log entry.
 */
function makeEntry(index: number): LiveServerRequestLogEntry {
  return {
    id: 'runtime-1',
    savedId: 1,
    timestamp: 1_700_000_000_000 + index,
    method: 'GET',
    url: `/${index}`,
    statusCode: 200,
    durationMs: 1,
    contentLength: null
  };
}

describe('pushLiveServerLog', () => {
  it('appends entries in order', () => {
    const buffer: LiveServerRequestLogEntry[] = [];
    pushLiveServerLog(buffer, makeEntry(0));
    pushLiveServerLog(buffer, makeEntry(1));
    expect(buffer.map((entry) => entry.url)).toEqual(['/0', '/1']);
  });

  it('drops oldest entries when exceeding the max', () => {
    const buffer: LiveServerRequestLogEntry[] = [];
    const max = 3;
    for (let index = 0; index < 5; index += 1) {
      pushLiveServerLog(buffer, makeEntry(index), max);
    }
    expect(buffer).toHaveLength(3);
    expect(buffer.map((entry) => entry.url)).toEqual(['/2', '/3', '/4']);
  });

  it('uses the default max of 1000', () => {
    expect(LIVE_SERVER_LOG_BUFFER_MAX).toBe(1000);
    const buffer: LiveServerRequestLogEntry[] = [];
    for (let index = 0; index < LIVE_SERVER_LOG_BUFFER_MAX + 5; index += 1) {
      pushLiveServerLog(buffer, makeEntry(index));
    }
    expect(buffer).toHaveLength(LIVE_SERVER_LOG_BUFFER_MAX);
    expect(buffer[0]?.url).toBe('/5');
    expect(buffer[buffer.length - 1]?.url).toBe(`/${LIVE_SERVER_LOG_BUFFER_MAX + 4}`);
  });
});
