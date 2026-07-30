import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultLiveServerCorsSettings } from '@harborclient/core/types';
import {
  assertDirectoryRoot,
  createLiveServerApp,
  normalizeAliasPath,
  resolveAliasTarget,
  toCorsOptions
} from './liveServerApp';

const tempRoots: string[] = [];
const servers: Server[] = [];

/**
 * Creates a temporary directory under the OS temp folder.
 *
 * @returns Absolute path to the new directory.
 */
function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-live-server-'));
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
 * Issues an HTTP GET against a listening Express app.
 *
 * @param app - Express app (not yet listening).
 * @param urlPath - Path to request.
 * @returns Status code and response body text.
 */
async function get(app: Express, urlPath: string): Promise<{ status: number; body: string }> {
  const origin = await listen(app);
  const response = await fetch(`${origin}${urlPath}`);
  return { status: response.status, body: await response.text() };
}

/**
 * Issues an HTTP request and returns status plus selected CORS headers.
 *
 * @param app - Express app (not yet listening).
 * @param urlPath - Path to request.
 * @param init - Optional fetch init (method, headers).
 * @returns Status and Access-Control response headers of interest.
 */
async function requestWithCorsHeaders(
  app: Express,
  urlPath: string,
  init?: RequestInit
): Promise<{
  status: number;
  allowOrigin: string | null;
  allowCredentials: string | null;
  allowMethods: string | null;
}> {
  const origin = await listen(app);
  const response = await fetch(`${origin}${urlPath}`, init);
  return {
    status: response.status,
    allowOrigin: response.headers.get('access-control-allow-origin'),
    allowCredentials: response.headers.get('access-control-allow-credentials'),
    allowMethods: response.headers.get('access-control-allow-methods')
  };
}

beforeEach(() => {
  // No shared state; temp dirs are created per test.
});

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

describe('normalizeAliasPath', () => {
  it('ensures a leading slash and strips trailing slashes', () => {
    expect(normalizeAliasPath('assets')).toBe('/assets');
    expect(normalizeAliasPath('/assets/')).toBe('/assets');
    expect(normalizeAliasPath('/')).toBe('/');
  });
});

describe('resolveAliasTarget', () => {
  it('resolves relative targets against the root', () => {
    expect(resolveAliasTarget('/site', 'build/assets')).toBe(path.resolve('/site', 'build/assets'));
  });

  it('keeps absolute targets absolute', () => {
    expect(resolveAliasTarget('/site', '/other')).toBe(path.resolve('/other'));
  });
});

describe('createLiveServerApp', () => {
  it('serves index.html from the document root', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>hello</h1>');
    const app = createLiveServerApp(root);
    const response = await get(app, '/');
    expect(response.status).toBe(200);
    expect(response.body).toContain('hello');
  });

  it('gives aliases precedence over the document root', async () => {
    const root = makeTempDir();
    const aliasDir = path.join(root, 'build', 'assets');
    fs.mkdirSync(aliasDir, { recursive: true });
    fs.writeFileSync(path.join(root, 'assets'), 'not-a-dir');
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>root</h1>');
    fs.writeFileSync(path.join(aliasDir, 'app.js'), 'console.log(1)');
    // Also put a conflicting file under root/assets path via nested dir for static.
    const rootAssets = path.join(root, 'public-assets');
    fs.mkdirSync(rootAssets, { recursive: true });

    const app = createLiveServerApp(root, [{ path: '/assets', target: 'build/assets' }]);
    const response = await get(app, '/assets/app.js');
    expect(response.status).toBe(200);
    expect(response.body).toContain('console.log(1)');
  });

  it('rejects path traversal outside the root', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>safe</h1>');
    const secret = path.join(root, '..', `secret-${path.basename(root)}.txt`);
    fs.writeFileSync(secret, 'secret');
    try {
      const app = createLiveServerApp(root);
      const response = await get(app, '/../' + path.basename(secret));
      expect(response.status).toBe(404);
      expect(response.body).not.toContain('secret');
    } finally {
      fs.rmSync(secret, { force: true });
    }
  });

  it('throws when the root is missing', () => {
    expect(() => assertDirectoryRoot(path.join(makeTempDir(), 'missing'))).toThrow(
      'Root directory does not exist'
    );
  });

  it('adds permissive CORS headers when CORS is enabled', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>cors</h1>');
    const app = createLiveServerApp(root, [], defaultLiveServerCorsSettings());
    const response = await requestWithCorsHeaders(app, '/', {
      headers: { Origin: 'http://example.com' }
    });
    expect(response.status).toBe(200);
    expect(response.allowOrigin).toBe('*');
  });

  it('omits CORS headers when CORS is disabled', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>no-cors</h1>');
    const app = createLiveServerApp(root, [], {
      ...defaultLiveServerCorsSettings(),
      enabled: false
    });
    const response = await requestWithCorsHeaders(app, '/', {
      headers: { Origin: 'http://example.com' }
    });
    expect(response.status).toBe(200);
    expect(response.allowOrigin).toBeNull();
  });

  it('reflects a specific origin and credentials when configured', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>cred</h1>');
    const app = createLiveServerApp(root, [], {
      enabled: true,
      origin: 'http://example.com',
      methods: 'GET,OPTIONS',
      allowedHeaders: '*',
      credentials: true
    });
    const response = await requestWithCorsHeaders(app, '/', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://example.com',
        'Access-Control-Request-Method': 'GET'
      }
    });
    expect(response.allowOrigin).toBe('http://example.com');
    expect(response.allowCredentials).toBe('true');
    expect(response.allowMethods?.toUpperCase()).toContain('GET');
  });

  it('emits an access log entry when a request completes', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>logged</h1>');
    const logs: Array<{
      method: string;
      url: string;
      statusCode: number;
      durationMs: number;
      contentLength: number | null;
    }> = [];
    const app = createLiveServerApp(root, [], defaultLiveServerCorsSettings(), (fields) => {
      logs.push(fields);
    });
    const response = await get(app, '/');
    expect(response.status).toBe(200);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.method).toBe('GET');
    expect(logs[0]?.url).toBe('/');
    expect(logs[0]?.statusCode).toBe(200);
    expect(logs[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('emits an access log entry for 404 responses', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>root</h1>');
    const logs: Array<{ statusCode: number; url: string }> = [];
    const app = createLiveServerApp(root, [], defaultLiveServerCorsSettings(), (fields) => {
      logs.push({ statusCode: fields.statusCode, url: fields.url });
    });
    const response = await get(app, '/missing.txt');
    expect(response.status).toBe(404);
    expect(logs).toEqual([{ statusCode: 404, url: '/missing.txt' }]);
  });
});

describe('toCorsOptions', () => {
  it('maps comma-separated origins and methods', () => {
    const options = toCorsOptions({
      enabled: true,
      origin: 'http://a.test, http://b.test',
      methods: 'GET, POST',
      allowedHeaders: 'Content-Type, Authorization',
      credentials: false
    });
    expect(options.origin).toEqual(['http://a.test', 'http://b.test']);
    expect(options.methods).toEqual(['GET', 'POST']);
    expect(options.allowedHeaders).toEqual(['Content-Type', 'Authorization']);
    expect(options.credentials).toBe(false);
  });
});
