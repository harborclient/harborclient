import { describe, expect, it } from 'vitest';
import type { LiveServerRequestLogEntry } from '@harborclient/core/types';
import { formatLiveServerLogLine, formatLiveServerLogTimestamp } from './formatLiveServerLogLine';

describe('formatLiveServerLogTimestamp', () => {
  it('zero-pads hours, minutes, seconds, and milliseconds', () => {
    const timestamp = new Date(2024, 0, 15, 3, 4, 5, 6).getTime();
    expect(formatLiveServerLogTimestamp(timestamp)).toBe('03:04:05.006');
  });
});

describe('formatLiveServerLogLine', () => {
  /**
   * Builds a log entry with overrides for formatting tests.
   *
   * @param overrides - Fields to replace on the base entry.
   * @returns Complete log entry.
   */
  function entry(overrides: Partial<LiveServerRequestLogEntry> = {}): LiveServerRequestLogEntry {
    return {
      id: 'runtime-1',
      savedId: 1,
      timestamp: new Date(2024, 0, 15, 12, 34, 56, 789).getTime(),
      method: 'GET',
      url: '/index.html',
      statusCode: 200,
      durationMs: 3,
      contentLength: null,
      ...overrides
    };
  }

  it('formats method, path, status, and duration', () => {
    expect(formatLiveServerLogLine(entry())).toBe('[12:34:56.789] GET /index.html 200 3ms');
  });

  it('appends content length when present', () => {
    expect(formatLiveServerLogLine(entry({ contentLength: 128 }))).toBe(
      '[12:34:56.789] GET /index.html 200 3ms 128b'
    );
  });
});
