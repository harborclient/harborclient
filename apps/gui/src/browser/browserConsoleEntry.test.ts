import { describe, expect, it } from 'vitest';
import {
  appendBrowserScriptResult,
  buildBrowserConsoleEntryPayload,
  createBrowserConsoleAccum,
  shouldEmitBrowserConsoleEntry
} from './browserConsoleEntry';
import type { SendResult } from '@harborclient/core/types';

/**
 * Minimal SendResult used by payload builder tests.
 *
 * @returns Snapshot shaped like buildBrowserPageResponseSnapshot.
 */
function sampleResult(): SendResult {
  return {
    status: 200,
    statusText: 'Example',
    headers: { 'content-type': 'text/html' },
    body: '<html></html>',
    timeMs: 0,
    sizeBytes: 13,
    request: {
      method: 'GET',
      url: 'https://example.com/',
      headers: {},
      body: '',
      bodyType: 'none'
    }
  };
}

describe('createBrowserConsoleAccum', () => {
  it('starts empty with a startedAt timestamp', () => {
    const before = Date.now();
    const accum = createBrowserConsoleAccum();
    expect(accum.logs).toEqual([]);
    expect(accum.tests).toEqual([]);
    expect(accum.executionEvents).toEqual([]);
    expect(accum.scriptErrorLines).toEqual([]);
    expect(accum.scriptErrors).toEqual([]);
    expect(accum.startedAt).toBeGreaterThanOrEqual(before);
  });
});

describe('appendBrowserScriptResult', () => {
  it('labels logs and tags tests with script metadata', () => {
    const accum = createBrowserConsoleAccum();
    appendBrowserScriptResult(accum, 'pre', 'script-1', 'Setup', {
      logs: [{ message: 'hello', level: 'log', method: 'log' }],
      tests: [{ name: 'ok', passed: true }],
      executionEvents: [
        { type: 'variable', scope: 'request', action: 'set', key: 'a', value: '1' }
      ],
      error: undefined,
      errorLocation: undefined
    });

    expect(accum.logs).toEqual([
      {
        message: 'hello',
        level: 'log',
        method: 'log',
        scriptName: 'Setup',
        scriptId: 'script-1',
        phase: 'pre',
        scope: 'request'
      }
    ]);
    expect(accum.tests[0]).toMatchObject({
      name: 'ok',
      scriptName: 'Setup',
      scriptId: 'script-1',
      phase: 'pre',
      scope: 'request'
    });
    expect(accum.executionEvents[0]).toMatchObject({
      type: 'variable',
      scriptName: 'Setup'
    });
  });

  it('records structured script errors', () => {
    const accum = createBrowserConsoleAccum();
    appendBrowserScriptResult(accum, 'post', 'script-2', 'Assert', {
      logs: [],
      tests: [],
      executionEvents: [],
      error: 'boom',
      errorLocation: { source: 'script.js', line: 3, column: 1 }
    });

    expect(accum.scriptErrorLines).toEqual(['Assert: boom']);
    expect(accum.scriptErrors[0]).toMatchObject({
      message: 'boom',
      scriptName: 'Assert',
      scriptId: 'script-2',
      phase: 'post',
      source: 'script.js',
      line: 3,
      column: 1
    });
  });
});

describe('shouldEmitBrowserConsoleEntry', () => {
  it('skips empty about:blank placeholders', () => {
    expect(shouldEmitBrowserConsoleEntry('about:blank', '')).toBe(false);
    expect(shouldEmitBrowserConsoleEntry('about:blank', 'Browser')).toBe(false);
  });

  it('emits real URLs and titled about:blank pages', () => {
    expect(shouldEmitBrowserConsoleEntry('https://example.com/', '')).toBe(true);
    expect(shouldEmitBrowserConsoleEntry('about:blank', 'My Page')).toBe(true);
  });
});

describe('buildBrowserConsoleEntryPayload', () => {
  it('applies elapsed timeMs and omits empty script fields', () => {
    const accum = createBrowserConsoleAccum();
    accum.startedAt = Date.now() - 50;
    const payload = buildBrowserConsoleEntryPayload('tab-1', sampleResult(), accum);

    expect(payload.tabId).toBe('tab-1');
    expect(payload.result.timeMs).toBeGreaterThanOrEqual(50);
    expect(payload.logs).toBeUndefined();
    expect(payload.tests).toBeUndefined();
    expect(payload.scriptError).toBeUndefined();
  });

  it('includes collected script fields', () => {
    const accum = createBrowserConsoleAccum();
    accum.logs.push({
      message: 'hi',
      level: 'log',
      method: 'log',
      scriptName: 'Setup',
      scriptId: 'script-1',
      phase: 'pre',
      scope: 'request'
    });
    accum.scriptErrorLines.push('Setup: fail');
    const payload = buildBrowserConsoleEntryPayload('tab-1', sampleResult(), accum);

    expect(payload.logs).toEqual([
      {
        message: 'hi',
        level: 'log',
        method: 'log',
        scriptName: 'Setup',
        scriptId: 'script-1',
        phase: 'pre',
        scope: 'request'
      }
    ]);
    expect(payload.scriptError).toBe('Setup: fail');
  });
});
