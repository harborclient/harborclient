import { describe, expect, it } from 'vitest';
import type { SendResult } from '../types';
import {
  applyScriptResponseOverride,
  buildScriptResponseOverride,
  httpStatusText
} from './scriptResponseOverride';

/**
 * Minimal SendResult fixture for apply tests.
 *
 * @param overrides - Fields to merge onto the default fixture.
 * @returns A SendResult suitable for unit tests.
 */
function baseResult(overrides: Partial<SendResult> = {}): SendResult {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'text/html' },
    body: 'real',
    timeMs: 42,
    sizeBytes: 4,
    ...overrides
  };
}

describe('httpStatusText', () => {
  it('returns known reason phrases', () => {
    expect(httpStatusText(200)).toBe('OK');
    expect(httpStatusText(400)).toBe('Bad Request');
    expect(httpStatusText(404)).toBe('Not Found');
  });

  it('returns empty string for unknown codes', () => {
    expect(httpStatusText(418)).toBe('');
  });
});

describe('buildScriptResponseOverride', () => {
  it('defaults status to 200 and content-type to text/plain', () => {
    expect(buildScriptResponseOverride('hello')).toEqual({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: 'hello'
    });
  });

  it('accepts explicit status and content type', () => {
    expect(buildScriptResponseOverride('oops', 400, 'text/html')).toEqual({
      status: 400,
      statusText: 'Bad Request',
      headers: { 'content-type': 'text/html' },
      body: 'oops'
    });
  });

  it('throws for non-integer or out-of-range status', () => {
    expect(() => buildScriptResponseOverride('x', 99)).toThrow(/100 and 599/);
    expect(() => buildScriptResponseOverride('x', 600)).toThrow(/100 and 599/);
    expect(() => buildScriptResponseOverride('x', 200.5)).toThrow(/100 and 599/);
    expect(() => buildScriptResponseOverride('x', 'nope')).toThrow(/100 and 599/);
  });
});

describe('applyScriptResponseOverride', () => {
  it('replaces status, headers, and body while preserving timing and request', () => {
    const applied = applyScriptResponseOverride(
      baseResult({
        timing: { stalledMs: 1, connectMs: 2, requestSentMs: 3, waitingMs: 4, downloadMs: 5 },
        request: {
          method: 'GET',
          url: 'https://example.com',
          headers: {},
          body: ''
        },
        bodyBase64: 'abc',
        error: 'Request skipped by script'
      }),
      buildScriptResponseOverride('{"ok":true}', 201, 'application/json')
    );

    expect(applied.status).toBe(201);
    expect(applied.statusText).toBe('Created');
    expect(applied.headers).toEqual({ 'content-type': 'application/json' });
    expect(applied.body).toBe('{"ok":true}');
    expect(applied.sizeBytes).toBe(new TextEncoder().encode('{"ok":true}').byteLength);
    expect(applied.timeMs).toBe(42);
    expect(applied.timing).toEqual({
      stalledMs: 1,
      connectMs: 2,
      requestSentMs: 3,
      waitingMs: 4,
      downloadMs: 5
    });
    expect(applied.request?.url).toBe('https://example.com');
    expect(applied.bodyBase64).toBeUndefined();
    expect(applied.error).toBeUndefined();
  });
});
