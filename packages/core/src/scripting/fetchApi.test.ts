import { describe, expect, it } from 'vitest';
import { createFetchResponse, fetchArgsToSendRequestInput } from './fetchApi';
import type { SendResult } from '../types';

describe('fetchArgsToSendRequestInput', () => {
  it('accepts a string URL with default GET', () => {
    const input = fetchArgsToSendRequestInput('https://api.example.com/v1');
    expect(input.method).toBe('GET');
    expect(input.url).toBe('https://api.example.com/v1');
    expect(input.headers).toEqual([]);
    expect(input.params).toEqual([]);
    expect(input.body).toBe('');
    expect(input.bodyType).toBe('none');
  });

  it('accepts URL instances', () => {
    const input = fetchArgsToSendRequestInput(new URL('https://api.example.com/path?q=1'));
    expect(input.url).toBe('https://api.example.com/path?q=1');
  });

  it('maps method, headers record, and JSON body', () => {
    const input = fetchArgsToSendRequestInput('https://api.example.com', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer t'
      },
      body: '{"ok":true}'
    });
    expect(input.method).toBe('POST');
    expect(input.body).toBe('{"ok":true}');
    expect(input.bodyType).toBe('json');
    expect(input.headers).toEqual([
      { key: 'Content-Type', value: 'application/json', enabled: true },
      { key: 'Authorization', value: 'Bearer t', enabled: true }
    ]);
  });

  it('accepts header list tuples', () => {
    const input = fetchArgsToSendRequestInput('https://api.example.com', {
      headers: [
        ['X-A', '1'],
        ['X-B', '2']
      ]
    });
    expect(input.headers).toEqual([
      { key: 'X-A', value: '1', enabled: true },
      { key: 'X-B', value: '2', enabled: true }
    ]);
  });

  it('accepts Headers-like forEach objects', () => {
    const headers = {
      forEach: (callback: (value: string, key: string) => void) => {
        callback('v', 'X-Test');
      }
    };
    const input = fetchArgsToSendRequestInput('https://api.example.com', { headers });
    expect(input.headers).toEqual([{ key: 'X-Test', value: 'v', enabled: true }]);
  });

  it('serializes URLSearchParams as urlencoded body', () => {
    const params = new URLSearchParams({ a: '1', b: 'two' });
    const input = fetchArgsToSendRequestInput('https://api.example.com', {
      method: 'POST',
      body: params
    });
    expect(input.body).toBe('a=1&b=two');
    expect(input.bodyType).toBe('urlencoded');
    expect(input.headers.some((h) => h.key.toLowerCase() === 'content-type')).toBe(true);
  });

  it('reads url/method/headers from a Request-like first argument', () => {
    const input = fetchArgsToSendRequestInput({
      url: 'https://api.example.com/from-request',
      method: 'PUT',
      headers: { Accept: 'text/plain' },
      body: 'hello'
    });
    expect(input.url).toBe('https://api.example.com/from-request');
    expect(input.method).toBe('PUT');
    expect(input.body).toBe('hello');
    expect(input.bodyType).toBe('text');
    expect(input.headers).toEqual([{ key: 'Accept', value: 'text/plain', enabled: true }]);
  });

  it('lets init override Request-like fields', () => {
    const input = fetchArgsToSendRequestInput(
      { url: 'https://api.example.com', method: 'GET', body: 'ignored' },
      { method: 'POST', body: 'from-init' }
    );
    expect(input.method).toBe('POST');
    expect(input.body).toBe('from-init');
  });

  it('throws when url is missing', () => {
    expect(() => fetchArgsToSendRequestInput('')).toThrow(/non-empty url/);
    expect(() => fetchArgsToSendRequestInput(null)).toThrow(/requires a url/);
  });

  it('throws on unsupported AbortSignal', () => {
    expect(() => fetchArgsToSendRequestInput('https://api.example.com', { signal: {} })).toThrow(
      /AbortSignal/
    );
  });

  it('throws on unsupported body types', () => {
    expect(() =>
      fetchArgsToSendRequestInput('https://api.example.com', {
        body: new ArrayBuffer(8) as unknown as string
      })
    ).toThrow(/does not support body type|must be a string/);
  });

  it('throws on unsupported HTTP methods', () => {
    expect(() =>
      fetchArgsToSendRequestInput('https://api.example.com', { method: 'TRACE' })
    ).toThrow(/does not support method/);
  });
});

describe('createFetchResponse', () => {
  const baseResult: SendResult = {
    status: 201,
    statusText: 'Created',
    headers: { 'Content-Type': 'application/json', 'X-Id': '9' },
    body: '{"ok":true}',
    timeMs: 12,
    sizeBytes: 10
  };

  it('exposes ok/status/statusText and header getters', async () => {
    const response = createFetchResponse(baseResult);
    expect(response.ok).toBe(true);
    expect(response.status).toBe(201);
    expect(response.statusText).toBe('Created');
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('X-Id')).toBe('9');
    expect(response.headers.has('missing')).toBe(false);
  });

  it('supports text, json, and arrayBuffer', async () => {
    const response = createFetchResponse(baseResult);
    await expect(response.text()).resolves.toBe('{"ok":true}');
    await expect(response.json()).resolves.toEqual({ ok: true });
    const buffer = await response.arrayBuffer();
    expect(new TextDecoder().decode(buffer)).toBe('{"ok":true}');
  });

  it('sets ok false for non-2xx status', () => {
    const response = createFetchResponse({ ...baseResult, status: 404, statusText: 'Not Found' });
    expect(response.ok).toBe(false);
  });
});
