import http from 'node:http';
import type { Server } from 'node:http';
import type { Express } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  LiveServerScriptRef,
  ScriptRunInput,
  ScriptRunResult,
  ScriptRequestContext
} from '@harborclient/core/types';
import { createLiveServerApp } from './liveServerApp';
import {
  applyLiveServerScriptRequestMutations,
  buildLiveServerScriptRequest,
  filterMatchingLiveServerScripts,
  type LiveServerScriptsHolder
} from './liveServerScripts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempRoots: string[] = [];
const servers: Server[] = [];

/**
 * Creates a temporary directory under the OS temp folder.
 *
 * @returns Absolute path to the new directory.
 */
function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-live-scripts-'));
  tempRoots.push(dir);
  return dir;
}

/**
 * Listens an Express app on an ephemeral port and returns the base URL.
 *
 * @param app - Express app (not yet listening).
 * @returns Base origin such as `http://127.0.0.1:12345`.
 */
async function listen(app: Express): Promise<string> {
  const server = await new Promise<Server>((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.on('error', reject);
  });
  servers.push(server);
  const address = server.address();
  if (typeof address !== 'object' || address == null) {
    throw new Error('Expected TCP address');
  }
  return `http://127.0.0.1:${address.port}`;
}

/**
 * Builds a minimal inline live-server script ref.
 *
 * @param overrides - Fields to replace.
 * @returns Script ref for tests.
 */
function scriptRef(overrides: Partial<LiveServerScriptRef> = {}): LiveServerScriptRef {
  return {
    id: overrides.id ?? 's1',
    enabled: overrides.enabled ?? true,
    kind: 'inline',
    code: overrides.code ?? '',
    stage: 'main',
    matchPath: overrides.matchPath ?? '*',
    ...overrides
  };
}

/**
 * Builds a passthrough ScriptRunResult from an input.
 *
 * @param input - Script run input.
 * @param patch - Optional result overrides.
 * @returns Script run result.
 */
function passthroughResult(
  input: ScriptRunInput,
  patch: Partial<ScriptRunResult> = {}
): ScriptRunResult {
  return {
    request: input.request,
    variableSets: {},
    variableClears: [],
    collectionVariableSets: {},
    collectionVariableClears: [],
    collectionHeaders: [],
    folderVariableSets: {},
    folderVariableClears: [],
    folderHeaders: [],
    environmentVariableSets: {},
    environmentVariableClears: [],
    globalVariableSets: {},
    globalVariableClears: [],
    cookieSets: {},
    cookieClears: [],
    tests: [],
    logs: [],
    executionEvents: [],
    data: input.data ?? {},
    ...patch
  };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        })
    )
  );
  for (const dir of tempRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('filterMatchingLiveServerScripts', () => {
  it('returns only enabled scripts whose matchPath matches', () => {
    const scripts = [
      scriptRef({ id: 'a', matchPath: 'index.html' }),
      scriptRef({ id: 'b', matchPath: '*.png', enabled: false }),
      scriptRef({ id: 'c', matchPath: '*' })
    ];
    expect(filterMatchingLiveServerScripts(scripts, '/docs/index.html').map((s) => s.id)).toEqual([
      'a',
      'c'
    ]);
  });
});

describe('applyLiveServerScriptRequestMutations', () => {
  it('updates req.url and req.originalUrl together preserving query', () => {
    const req = {
      url: '/old?q=1',
      originalUrl: '/old?q=1',
      headers: {} as Record<string, string>
    };
    const scriptRequest: ScriptRequestContext = {
      method: 'GET',
      url: 'http://127.0.0.1:5500/new?q=1',
      headers: [{ key: 'x-test', value: '1', enabled: true }],
      params: [],
      body: '',
      bodyType: 'none'
    };
    applyLiveServerScriptRequestMutations(req as never, scriptRequest, 'http://127.0.0.1:5500');
    expect(req.url).toBe('/new?q=1');
    expect(req.originalUrl).toBe('/new?q=1');
    expect(req.headers['x-test']).toBe('1');
  });
});

describe('buildLiveServerScriptRequest', () => {
  it('builds an absolute URL from origin and originalUrl', () => {
    const req = {
      method: 'GET',
      originalUrl: '/index.html?x=1',
      url: '/index.html?x=1',
      headers: { host: '127.0.0.1:5500' },
      query: { x: '1' }
    };
    const built = buildLiveServerScriptRequest(req as never, 'http://127.0.0.1:5500');
    expect(built.url).toBe('http://127.0.0.1:5500/index.html?x=1');
    expect(built.method).toBe('GET');
    expect(built.params).toEqual([{ key: 'x', value: '1', enabled: true }]);
  });
});

describe('live server scripts middleware ordering', () => {
  it('awaits a slow pre script before the proxy upstream sees the request', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<html></html>');

    let upstreamSawRequestAt = 0;
    const upstream = http.createServer((_req, res) => {
      upstreamSawRequestAt = Date.now();
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
    });
    await new Promise<void>((resolve) => {
      upstream.listen(0, '127.0.0.1', () => resolve());
    });
    servers.push(upstream);
    const upstreamAddress = upstream.address();
    if (typeof upstreamAddress !== 'object' || upstreamAddress == null) {
      throw new Error('Expected TCP address');
    }
    const upstreamOrigin = `http://127.0.0.1:${upstreamAddress.port}`;

    let scriptStartedAt = 0;
    let scriptFinishedAt = 0;
    const runScript = vi.fn(async (input: ScriptRunInput) => {
      scriptStartedAt = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 80));
      scriptFinishedAt = Date.now();
      return passthroughResult(input);
    });

    const holder: LiveServerScriptsHolder = {
      preRequestScripts: [scriptRef({ code: 'hc.log("pre");', matchPath: '*' })],
      postRequestScripts: []
    };

    const app = createLiveServerApp(root, {
      proxies: [{ path: '/', target: upstreamOrigin, stripPath: false, enabled: true }],
      scripts: {
        getScripts: () => holder,
        savedId: 1,
        runtimeId: 'runtime-1',
        getOrigin: () => 'http://127.0.0.1:5500',
        listSnippets: () => [],
        getVariables: () => ({}),
        runScript
      }
    });

    const origin = await listen(app);
    const response = await fetch(`${origin}/api/echo`);
    expect(response.status).toBe(200);
    expect(runScript).toHaveBeenCalled();
    expect(scriptFinishedAt).toBeGreaterThan(0);
    expect(upstreamSawRequestAt).toBeGreaterThanOrEqual(scriptFinishedAt);
    expect(scriptStartedAt).toBeGreaterThan(0);
  });

  it('rewrites path and preserves the original query for the proxy upstream', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<html></html>');

    let upstreamUrl = '';
    const upstream = http.createServer((req, res) => {
      upstreamUrl = req.url ?? '';
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
    });
    await new Promise<void>((resolve) => {
      upstream.listen(0, '127.0.0.1', () => resolve());
    });
    servers.push(upstream);
    const upstreamAddress = upstream.address();
    if (typeof upstreamAddress !== 'object' || upstreamAddress == null) {
      throw new Error('Expected TCP address');
    }
    const upstreamOrigin = `http://127.0.0.1:${upstreamAddress.port}`;

    const runScript = vi.fn(async (input: ScriptRunInput) => {
      return passthroughResult(input, {
        request: {
          ...input.request,
          url: 'http://127.0.0.1:5500/rewritten?keep=1'
        }
      });
    });

    const holder: LiveServerScriptsHolder = {
      preRequestScripts: [scriptRef({ code: 'hc.request.url = "...";', matchPath: '*' })],
      postRequestScripts: []
    };

    const app = createLiveServerApp(root, {
      proxies: [{ path: '/', target: upstreamOrigin, stripPath: false, enabled: true }],
      scripts: {
        getScripts: () => holder,
        savedId: 1,
        runtimeId: 'runtime-1',
        getOrigin: () => 'http://127.0.0.1:5500',
        listSnippets: () => [],
        getVariables: () => ({}),
        runScript
      }
    });

    const origin = await listen(app);
    const response = await fetch(`${origin}/old?keep=1`);
    expect(response.status).toBe(200);
    expect(upstreamUrl).toBe('/rewritten?keep=1');
  });

  it('fails open when a pre script throws so the upstream still receives the request', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<html></html>');

    let upstreamHit = false;
    const upstream = http.createServer((_req, res) => {
      upstreamHit = true;
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
    });
    await new Promise<void>((resolve) => {
      upstream.listen(0, '127.0.0.1', () => resolve());
    });
    servers.push(upstream);
    const upstreamAddress = upstream.address();
    if (typeof upstreamAddress !== 'object' || upstreamAddress == null) {
      throw new Error('Expected TCP address');
    }
    const upstreamOrigin = `http://127.0.0.1:${upstreamAddress.port}`;

    const runScript = vi.fn(async () => {
      throw new Error('boom');
    });

    const holder: LiveServerScriptsHolder = {
      preRequestScripts: [scriptRef({ code: 'throw new Error("boom");', matchPath: '*' })],
      postRequestScripts: []
    };

    const app = createLiveServerApp(root, {
      proxies: [{ path: '/', target: upstreamOrigin, stripPath: false, enabled: true }],
      scripts: {
        getScripts: () => holder,
        savedId: 1,
        runtimeId: 'runtime-1',
        getOrigin: () => 'http://127.0.0.1:5500',
        listSnippets: () => [],
        getVariables: () => ({}),
        runScript
      }
    });

    const origin = await listen(app);
    const response = await fetch(`${origin}/api`);
    expect(response.status).toBe(200);
    expect(upstreamHit).toBe(true);
  });

  it('short-circuits with 204 when skipRequest is set', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<html>hi</html>');

    const runScript = vi.fn(async (input: ScriptRunInput) =>
      passthroughResult(input, { skipRequest: true })
    );

    const holder: LiveServerScriptsHolder = {
      preRequestScripts: [scriptRef({ code: 'hc.execution.skipRequest();', matchPath: '*' })],
      postRequestScripts: []
    };

    const app = createLiveServerApp(root, {
      scripts: {
        getScripts: () => holder,
        savedId: 1,
        runtimeId: 'runtime-1',
        getOrigin: () => 'http://127.0.0.1:5500',
        listSnippets: () => [],
        getVariables: () => ({}),
        runScript
      }
    });

    const origin = await listen(app);
    const response = await fetch(`${origin}/index.html`);
    expect(response.status).toBe(204);
    expect(runScript).toHaveBeenCalled();
  });

  it('short-circuits with hc.send responseOverride from a pre-request script', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<html>hi</html>');

    const runScript = vi.fn(async (input: ScriptRunInput) =>
      passthroughResult(input, {
        responseOverride: {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
          body: '{"error":"Something happened."}'
        }
      })
    );

    const holder: LiveServerScriptsHolder = {
      preRequestScripts: [
        scriptRef({ code: 'await hc.sendJSON({ error: "x" }, 400);', matchPath: '*' })
      ],
      postRequestScripts: []
    };

    const app = createLiveServerApp(root, {
      scripts: {
        getScripts: () => holder,
        savedId: 1,
        runtimeId: 'runtime-1',
        getOrigin: () => 'http://127.0.0.1:5500',
        listSnippets: () => [],
        getVariables: () => ({}),
        runScript
      }
    });

    const origin = await listen(app);
    const response = await fetch(`${origin}/index.html`);
    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    expect(await response.text()).toBe('{"error":"Something happened."}');
  });

  it('warns when responseOverride is set in a post-request script', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<html>hi</html>');

    const onScriptLog = vi.fn();
    const runScript = vi.fn(async (input: ScriptRunInput) => {
      if (input.phase === 'post') {
        return passthroughResult(input, {
          responseOverride: {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'text/plain; charset=utf-8' },
            body: 'ignored'
          }
        });
      }
      return passthroughResult(input);
    });

    const holder: LiveServerScriptsHolder = {
      preRequestScripts: [],
      postRequestScripts: [scriptRef({ code: 'await hc.send("ignored");', matchPath: '*' })]
    };

    const app = createLiveServerApp(root, {
      scripts: {
        getScripts: () => holder,
        savedId: 1,
        runtimeId: 'runtime-1',
        getOrigin: () => 'http://127.0.0.1:5500',
        listSnippets: () => [],
        getVariables: () => ({}),
        runScript,
        onScriptLog
      }
    });

    const origin = await listen(app);
    const response = await fetch(`${origin}/index.html`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('hi');

    await vi.waitFor(() => {
      expect(onScriptLog).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'post',
          level: 'warn',
          message: expect.stringContaining('ignored in live-server post-request scripts')
        })
      );
    });
  });
});
