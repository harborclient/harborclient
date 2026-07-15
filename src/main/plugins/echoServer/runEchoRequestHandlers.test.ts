import { describe, expect, it, vi } from 'vitest';
import { runEchoRequestHandlers } from './runEchoRequestHandlers';
import type { EchoServerIncomingRequest } from './types';

const defaultEcho = {
  args: { foo: 'bar' },
  data: '',
  files: {},
  form: {},
  headers: { host: 'localhost:3000' },
  json: null,
  origin: '127.0.0.1',
  url: 'http://localhost:3000/?foo=bar'
};

const request: EchoServerIncomingRequest = {
  method: 'GET',
  url: 'http://localhost:3000/?foo=bar',
  path: '/',
  query: { foo: 'bar' },
  headers: { host: 'localhost:3000' },
  body: '',
  bodyType: 'none',
  params: [],
  echo: defaultEcho
};

describe('runEchoRequestHandlers', () => {
  it('returns undefined when no handlers are registered', async () => {
    await expect(runEchoRequestHandlers([], request)).resolves.toBeUndefined();
  });

  it('returns custom body from a single handler', async () => {
    await expect(
      runEchoRequestHandlers([async () => ({ custom: true })], request)
    ).resolves.toEqual({ custom: true });
  });

  it('returns undefined when a single handler returns undefined', async () => {
    await expect(runEchoRequestHandlers([async () => undefined], request)).resolves.toBeUndefined();
  });

  it('keeps the first custom body when a later handler returns undefined', async () => {
    await expect(
      runEchoRequestHandlers([async () => ({ custom: true }), async () => undefined], request)
    ).resolves.toEqual({ custom: true });
  });

  it('uses the second custom body when the first handler returns undefined', async () => {
    await expect(
      runEchoRequestHandlers([async () => undefined, async () => ({ custom: true })], request)
    ).resolves.toEqual({ custom: true });
  });

  it('uses the last custom body when multiple handlers return values', async () => {
    await expect(
      runEchoRequestHandlers([async () => ({ step: 1 }), async () => ({ step: 2 })], request)
    ).resolves.toEqual({ step: 2 });
  });

  it('propagates errors from a handler', async () => {
    await expect(
      runEchoRequestHandlers([async () => Promise.reject(new Error('handler failed'))], request)
    ).rejects.toThrow('handler failed');
  });

  it('runs handlers in registration order', async () => {
    const order: number[] = [];
    const first = vi.fn(async () => {
      order.push(1);
      return undefined;
    });
    const second = vi.fn(async () => {
      order.push(2);
      return { done: true };
    });

    await runEchoRequestHandlers([first, second], request);

    expect(order).toEqual([1, 2]);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });
});
