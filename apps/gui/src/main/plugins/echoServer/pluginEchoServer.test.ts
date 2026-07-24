import { describe, expect, it, afterEach } from 'vitest';
import {
  getEchoServerStatus,
  setEchoServerIncomingHandler,
  startEchoServer,
  stopEchoServer,
  stopAllEchoServers
} from './pluginEchoServer';

describe('pluginEchoServer', () => {
  afterEach(async () => {
    setEchoServerIncomingHandler(null);
    await stopAllEchoServers();
  });

  it('starts on port 0 and returns an assigned non-privileged port', async () => {
    const port = await startEchoServer('test.echo', { port: 0 });
    expect(port).toBeGreaterThan(0);
    expect(getEchoServerStatus('test.echo')).toEqual({ running: true, port });
  });

  it('stops a running echo server', async () => {
    await startEchoServer('test.echo', { port: 0 });
    await stopEchoServer('test.echo');
    expect(getEchoServerStatus('test.echo')).toEqual({ running: false });
  });

  it('returns default httpbin-style echo JSON for GET requests', async () => {
    const port = await startEchoServer('test.echo', { port: 0 });
    const response = await fetch(`http://127.0.0.1:${port}/hello?foo=bar`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      args: Record<string, string>;
      url: string;
      headers: Record<string, string>;
    };
    expect(body.args).toEqual({ foo: 'bar' });
    expect(body.url).toContain(`/hello?foo=bar`);
    expect(body.headers).toBeDefined();
  });

  it('returns default echo JSON for POST requests with JSON body', async () => {
    const port = await startEchoServer('test.echo', { port: 0 });
    const response = await fetch(`http://127.0.0.1:${port}/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hello: 'world' })
    });
    const body = (await response.json()) as {
      data: string;
      json: Record<string, unknown> | null;
    };
    expect(body.data).toBe(JSON.stringify({ hello: 'world' }));
    expect(body.json).toEqual({ hello: 'world' });
  });

  it('returns custom JSON when the incoming handler returns a value', async () => {
    setEchoServerIncomingHandler(async () => ({ custom: true }));
    const port = await startEchoServer('test.echo', { port: 0 });
    const response = await fetch(`http://127.0.0.1:${port}/custom`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ custom: true });
  });

  it('returns default echo JSON when the incoming handler returns null', async () => {
    setEchoServerIncomingHandler(async () => null);
    const port = await startEchoServer('test.echo', { port: 0 });
    const response = await fetch(`http://127.0.0.1:${port}/hello?foo=bar`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { args: Record<string, string> };
    expect(body.args).toEqual({ foo: 'bar' });
  });

  it('returns default echo JSON when the incoming handler returns undefined', async () => {
    setEchoServerIncomingHandler(async () => undefined);
    const port = await startEchoServer('test.echo', { port: 0 });
    const response = await fetch(`http://127.0.0.1:${port}/hello?foo=bar`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { args: Record<string, string> };
    expect(body.args).toEqual({ foo: 'bar' });
  });

  it('applies structured status, headers, and JSON body', async () => {
    setEchoServerIncomingHandler(async () => ({
      kind: 'http-response',
      status: 404,
      headers: { 'X-Mock': 'yes' },
      body: { error: 'missing' }
    }));
    const port = await startEchoServer('test.echo', { port: 0 });
    const response = await fetch(`http://127.0.0.1:${port}/missing`);
    expect(response.status).toBe(404);
    expect(response.headers.get('X-Mock')).toBe('yes');
    await expect(response.json()).resolves.toEqual({ error: 'missing' });
  });

  it('sends string bodies as text/plain by default', async () => {
    setEchoServerIncomingHandler(async () => ({
      kind: 'http-response',
      status: 201,
      body: 'created'
    }));
    const port = await startEchoServer('test.echo', { port: 0 });
    const response = await fetch(`http://127.0.0.1:${port}/text`);
    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toContain('text/plain');
    await expect(response.text()).resolves.toBe('created');
  });

  it('delays structured responses before writing', async () => {
    setEchoServerIncomingHandler(async () => ({
      kind: 'http-response',
      status: 200,
      body: { ok: true },
      delayMs: 80
    }));
    const port = await startEchoServer('test.echo', { port: 0 });
    const started = Date.now();
    const response = await fetch(`http://127.0.0.1:${port}/slow`);
    const elapsed = Date.now() - started;
    expect(response.status).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(60);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('keeps legacy bare objects as HTTP 200 JSON bodies', async () => {
    setEchoServerIncomingHandler(async () => ({ status: 404, error: 'not structured' }));
    const port = await startEchoServer('test.echo', { port: 0 });
    const response = await fetch(`http://127.0.0.1:${port}/legacy`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 404, error: 'not structured' });
  });

  it('still serves GET /health without the incoming handler', async () => {
    setEchoServerIncomingHandler(async () => ({
      kind: 'http-response',
      status: 500,
      body: { should: 'not run' }
    }));
    const port = await startEchoServer('test.echo', { port: 0 });
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('supports Mock Server-style stub matching with status, headers, delay, and 404', async () => {
    type Stub = {
      method: string;
      path: string;
      status: number;
      body: unknown;
      delayMs?: number;
      headers?: Record<string, string>;
    };

    const stubs: Stub[] = [
      {
        method: 'GET',
        path: '/health-mock',
        status: 200,
        headers: { 'X-Mock': '1' },
        body: { ok: true }
      },
      {
        method: '*',
        path: '/slow',
        status: 503,
        delayMs: 60,
        headers: { 'X-Mock': 'slow' },
        body: { error: 'slow' }
      }
    ];

    setEchoServerIncomingHandler(async (_pluginId, request) => {
      const match = stubs.find(
        (stub) =>
          (stub.method === '*' || stub.method.toUpperCase() === request.method.toUpperCase()) &&
          stub.path === request.path
      );
      if (!match) {
        return {
          kind: 'http-response',
          status: 404,
          body: { error: 'No stub matched', method: request.method, path: request.path }
        };
      }
      return {
        kind: 'http-response',
        status: match.status,
        headers: match.headers,
        body: match.body,
        delayMs: match.delayMs
      };
    });

    const port = await startEchoServer('test.echo', { port: 0 });
    const base = `http://127.0.0.1:${port}`;

    const ok = await fetch(`${base}/health-mock`);
    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toEqual({ ok: true });

    const missing = await fetch(`${base}/nope`);
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toMatchObject({ error: 'No stub matched' });

    const started = Date.now();
    const slow = await fetch(`${base}/slow`);
    expect(slow.status).toBe(503);
    expect(slow.headers.get('X-Mock')).toBe('slow');
    expect(Date.now() - started).toBeGreaterThanOrEqual(40);
    await expect(slow.json()).resolves.toEqual({ error: 'slow' });
  });
});
