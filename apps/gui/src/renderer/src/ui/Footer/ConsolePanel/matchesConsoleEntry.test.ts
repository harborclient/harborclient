import { describe, expect, it } from 'vitest';
import type { ConsoleEntry } from '#/renderer/src/store';
import type { SendResult } from '@harborclient/core/types';
import { matchesConsoleEntry } from './matchesConsoleEntry';

/**
 * Builds a minimal SendResult for console entry matching tests.
 *
 * @param overrides - Fields to merge onto the default successful GET result.
 * @returns A SendResult suitable for ConsoleEntry fixtures.
 */
function sampleResult(overrides: Partial<SendResult> = {}): SendResult {
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    body: '',
    timeMs: 10,
    sizeBytes: 0,
    request: {
      method: 'GET',
      url: 'https://echo.harborclient.com/get',
      headers: {},
      body: '',
      bodyType: 'none'
    },
    ...overrides
  };
}

/**
 * Builds a ConsoleEntry fixture with optional field overrides.
 *
 * @param overrides - Fields to merge onto the default entry.
 * @returns A ConsoleEntry for matcher tests.
 */
function sampleEntry(overrides: Partial<ConsoleEntry> = {}): ConsoleEntry {
  return {
    id: 'entry-1',
    timestamp: Date.now(),
    requestName: 'Echo GET',
    collectionName: 'Samples',
    result: sampleResult(),
    ...overrides
  };
}

describe('matchesConsoleEntry', () => {
  it('matches everything when the query is empty or whitespace', () => {
    const entry = sampleEntry();
    expect(matchesConsoleEntry(entry, '')).toBe(true);
    expect(matchesConsoleEntry(entry, '   ')).toBe(true);
  });

  it('matches method, URL, status, and names case-insensitively', () => {
    const entry = sampleEntry();
    expect(matchesConsoleEntry(entry, 'get')).toBe(true);
    expect(matchesConsoleEntry(entry, 'ECHO.HARBORCLIENT')).toBe(true);
    expect(matchesConsoleEntry(entry, '200 ok')).toBe(true);
    expect(matchesConsoleEntry(entry, 'echo get')).toBe(true);
    expect(matchesConsoleEntry(entry, 'samples')).toBe(true);
  });

  it('matches Error status label when the send failed', () => {
    const entry = sampleEntry({
      result: sampleResult({
        error: 'Network failure',
        status: 0,
        statusText: ''
      })
    });
    expect(matchesConsoleEntry(entry, 'error')).toBe(true);
    expect(matchesConsoleEntry(entry, '200')).toBe(false);
  });

  it('returns false when no visible row field contains the query', () => {
    expect(matchesConsoleEntry(sampleEntry(), 'post')).toBe(false);
    expect(matchesConsoleEntry(sampleEntry(), 'missing-name')).toBe(false);
  });
});
