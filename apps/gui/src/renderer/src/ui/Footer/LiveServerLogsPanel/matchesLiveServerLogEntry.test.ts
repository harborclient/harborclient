import { describe, expect, it } from 'vitest';
import type {
  LiveServerProcessLogEntry,
  LiveServerRequestLogEntry,
  LiveServerScriptLogEntry
} from '@harborclient/core/types';
import { matchesLiveServerLogEntry } from './matchesLiveServerLogEntry';

/**
 * Builds an access log entry with overrides for matcher tests.
 *
 * @param overrides - Fields to replace on the base entry.
 * @returns Complete access log entry.
 */
function accessEntry(
  overrides: Partial<LiveServerRequestLogEntry> = {}
): LiveServerRequestLogEntry {
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
 * Builds a script log entry with overrides for matcher tests.
 *
 * @param overrides - Fields to replace on the base entry.
 * @returns Complete script log entry.
 */
function scriptEntry(overrides: Partial<LiveServerScriptLogEntry> = {}): LiveServerScriptLogEntry {
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

/**
 * Builds a process log entry with overrides for matcher tests.
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
    message: 'Echo server listening on http://127.0.0.1:3000',
    ...overrides
  };
}

describe('matchesLiveServerLogEntry', () => {
  it('matches against the formatted terminal line', () => {
    expect(matchesLiveServerLogEntry(accessEntry(), 'get')).toBe(true);
    expect(matchesLiveServerLogEntry(accessEntry(), '/INDEX.HTML')).toBe(true);
    expect(matchesLiveServerLogEntry(scriptEntry(), 'hello')).toBe(true);
    expect(matchesLiveServerLogEntry(processEntry(), 'listening')).toBe(true);
    expect(matchesLiveServerLogEntry(accessEntry(), 'post')).toBe(false);
  });
});
