import { describe, expect, it } from 'vitest';
import type { ScriptLogEntry, ScriptRunError } from '@harborclient/core/types';
import {
  DEFAULT_LOG_MATCH_OPTIONS,
  type LogMatchOptions
} from '#/renderer/src/ui/Shared/LogSearch/logMatchOptions';
import {
  matchesScriptLogEntry,
  matchesScriptRunError,
  scriptLogEntryHaystack
} from './matchesScriptLogEntry';

/**
 * Builds a script log entry with overrides for matcher tests.
 *
 * @param overrides - Fields to replace on the base entry.
 * @returns Complete script log entry.
 */
function logEntry(overrides: Partial<ScriptLogEntry> = {}): ScriptLogEntry {
  return {
    message: 'hc.before is not a function',
    level: 'error',
    method: 'error',
    scriptName: 'script.js',
    ...overrides
  };
}

/**
 * Builds a structured script error with overrides for matcher tests.
 *
 * @param overrides - Fields to replace on the base error.
 * @returns Complete script run error.
 */
function runError(overrides: Partial<ScriptRunError> = {}): ScriptRunError {
  return {
    message: 'script.js:2:4: hc.before is not a function',
    scriptName: 'before all',
    ...overrides
  };
}

/**
 * Convenience wrapper for matcher options in tests.
 *
 * @param overrides - Fields to replace on the defaults.
 * @returns Complete match options.
 */
function options(overrides: Partial<LogMatchOptions> = {}): LogMatchOptions {
  return { ...DEFAULT_LOG_MATCH_OPTIONS, ...overrides };
}

describe('scriptLogEntryHaystack', () => {
  it('joins level, script name, and message', () => {
    expect(scriptLogEntryHaystack(logEntry())).toBe('error script.js hc.before is not a function');
  });
});

describe('matchesScriptLogEntry', () => {
  it('matches message, script name, and level', () => {
    const entry = logEntry();
    expect(matchesScriptLogEntry(entry, 'hc.before')).toBe(true);
    expect(matchesScriptLogEntry(entry, 'SCRIPT.JS')).toBe(true);
    expect(matchesScriptLogEntry(entry, 'error')).toBe(true);
    expect(matchesScriptLogEntry(entry, 'missing')).toBe(false);
  });

  it('respects match case', () => {
    const entry = logEntry();
    expect(matchesScriptLogEntry(entry, 'ERROR', options({ matchCase: true }))).toBe(false);
    expect(matchesScriptLogEntry(entry, 'error', options({ matchCase: true }))).toBe(true);
  });
});

describe('matchesScriptRunError', () => {
  it('matches error message and script name', () => {
    const error = runError();
    expect(matchesScriptRunError(error, 'hc.before')).toBe(true);
    expect(matchesScriptRunError(error, 'before all')).toBe(true);
    expect(matchesScriptRunError(error, 'missing')).toBe(false);
  });
});
