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
});
