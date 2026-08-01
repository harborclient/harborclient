import { describe, expect, it } from 'vitest';
import type {
  LiveServerProcessLogEntry,
  LiveServerRequestLogEntry,
  LiveServerScriptLogEntry
} from '@harborclient/core/types';
import { formatLiveServerLogLine, formatLiveServerLogTimestamp } from './formatLiveServerLogLine';

describe('formatLiveServerLogTimestamp', () => {
  it('zero-pads hours, minutes, seconds, and milliseconds', () => {
    const timestamp = new Date(2024, 0, 15, 3, 4, 5, 6).getTime();
    expect(formatLiveServerLogTimestamp(timestamp)).toBe('03:04:05.006');
  });
});

describe('formatLiveServerLogLine', () => {
  /**
   * Builds an access log entry with overrides for formatting tests.
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

  /**
   * Builds a script log entry with overrides.
   *
   * @param overrides - Fields to replace on the base entry.
   * @returns Complete script log entry.
   */
  function scriptEntry(
    overrides: Partial<LiveServerScriptLogEntry> = {}
  ): LiveServerScriptLogEntry {
    return {
      kind: 'script',
      id: 'runtime-1',
      savedId: 1,
      timestamp: new Date(2024, 0, 15, 12, 34, 56, 789).getTime(),
      phase: 'pre',
      url: '/index.html',
      scriptLabel: 'index.html',
      level: 'log',
      message: 'hello',
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

  it('formats script console lines', () => {
    expect(formatLiveServerLogLine(scriptEntry())).toBe('[12:34:56.789] pre /index.html log hello');
  });

  it('formats passing and failing tests', () => {
    expect(
      formatLiveServerLogLine(
        scriptEntry({ phase: 'post', level: 'test', message: 'status is 200', passed: true })
      )
    ).toBe('[12:34:56.789] post /index.html ✓ status is 200');
    expect(
      formatLiveServerLogLine(
        scriptEntry({ phase: 'post', level: 'test', message: 'status is 200', passed: false })
      )
    ).toBe('[12:34:56.789] post /index.html ✗ status is 200');
  });

  /**
   * Builds a process log entry with overrides.
   *
   * @param overrides - Fields to replace on the base entry.
   * @returns Complete process log entry.
   */
  function processEntry(
    overrides: Partial<LiveServerProcessLogEntry> = {}
  ): LiveServerProcessLogEntry {
    return {
      kind: 'process',
      id: 'runtime-1',
      savedId: 1,
      timestamp: new Date(2024, 0, 15, 12, 34, 56, 789).getTime(),
      stream: 'stdout',
      message: 'listening',
      ...overrides
    };
  }

  it('formats process stdout, stderr, and system lines', () => {
    expect(formatLiveServerLogLine(processEntry())).toBe('[12:34:56.789] run stdout listening');
    expect(formatLiveServerLogLine(processEntry({ stream: 'stderr', message: 'boom' }))).toBe(
      '[12:34:56.789] run stderr boom'
    );
    expect(
      formatLiveServerLogLine(
        processEntry({ stream: 'system', message: 'Run command failed: spawn ENOENT' })
      )
    ).toBe('[12:34:56.789] run Run command failed: spawn ENOENT');
  });
});
