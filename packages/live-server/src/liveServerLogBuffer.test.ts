import { describe, expect, it } from 'vitest';
import type { LiveServerLogEntry, LiveServerRequestLogEntry } from '@harborclient/core/types';
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
    const buffer: LiveServerLogEntry[] = [];
    pushLiveServerLog(buffer, makeEntry(0));
    pushLiveServerLog(buffer, makeEntry(1));
    expect(buffer.map((entry) => entry.timestamp)).toEqual([1_700_000_000_000, 1_700_000_000_001]);
  });

  it('drops oldest entries when exceeding the max', () => {
    const buffer: LiveServerLogEntry[] = [];
    const max = 3;
    for (let index = 0; index < 5; index += 1) {
      pushLiveServerLog(buffer, makeEntry(index), max);
    }
    expect(buffer).toHaveLength(3);
    expect(buffer.map((entry) => entry.timestamp)).toEqual([
      1_700_000_000_002, 1_700_000_000_003, 1_700_000_000_004
    ]);
  });

  it('uses the default max of 1000', () => {
    expect(LIVE_SERVER_LOG_BUFFER_MAX).toBe(1000);
    const buffer: LiveServerLogEntry[] = [];
    for (let index = 0; index < LIVE_SERVER_LOG_BUFFER_MAX + 5; index += 1) {
      pushLiveServerLog(buffer, makeEntry(index));
    }
    expect(buffer).toHaveLength(LIVE_SERVER_LOG_BUFFER_MAX);
    expect(buffer[0]?.timestamp).toBe(1_700_000_000_005);
    expect(buffer[buffer.length - 1]?.timestamp).toBe(
      1_700_000_000_000 + LIVE_SERVER_LOG_BUFFER_MAX + 4
    );
  });
});
