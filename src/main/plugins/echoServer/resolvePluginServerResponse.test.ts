import { describe, expect, it } from 'vitest';
import {
  isPluginServerHttpResponse,
  normalizePluginServerHttpResponse
} from './resolvePluginServerResponse';

describe('isPluginServerHttpResponse', () => {
  it('accepts objects with kind http-response', () => {
    expect(isPluginServerHttpResponse({ kind: 'http-response', status: 404 })).toBe(true);
  });

  it('rejects legacy JSON bodies that happen to include status', () => {
    expect(isPluginServerHttpResponse({ status: 404 })).toBe(false);
    expect(isPluginServerHttpResponse({ custom: true })).toBe(false);
    expect(isPluginServerHttpResponse(null)).toBe(false);
    expect(isPluginServerHttpResponse('text')).toBe(false);
  });
});

describe('normalizePluginServerHttpResponse', () => {
  it('defaults status, delay, and empty body', () => {
    expect(normalizePluginServerHttpResponse({ kind: 'http-response' })).toEqual({
      status: 200,
      headers: {},
      body: null,
      delayMs: 0,
      sendAsText: false
    });
  });

  it('preserves string bodies as text and clamps delay', () => {
    expect(
      normalizePluginServerHttpResponse({
        kind: 'http-response',
        status: 201,
        headers: { 'X-Test': '1', '': 'skip', 'bad': 1 as unknown as string },
        body: 'plain',
        delayMs: 120_000
      })
    ).toEqual({
      status: 201,
      headers: { 'X-Test': '1' },
      body: 'plain',
      delayMs: 60_000,
      sendAsText: true
    });
  });

  it('falls back to 200 for invalid status codes', () => {
    expect(normalizePluginServerHttpResponse({ kind: 'http-response', status: 99 }).status).toBe(
      200
    );
    expect(normalizePluginServerHttpResponse({ kind: 'http-response', status: 999 }).status).toBe(
      200
    );
  });
});
