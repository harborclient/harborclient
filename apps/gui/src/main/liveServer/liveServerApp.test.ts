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
  isPathInsideDirectory,
  normalizeAliasPath,
  pathMatchesLiveServerRoute,
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
  exposeHeaders: string | null;
  maxAge: string | null;
}> {
  const origin = await listen(app);
  const response = await fetch(`${origin}${urlPath}`, init);
  return {
    status: response.status,
    allowOrigin: response.headers.get('access-control-allow-origin'),
    allowCredentials: response.headers.get('access-control-allow-credentials'),
    allowMethods: response.headers.get('access-control-allow-methods'),
    exposeHeaders: response.headers.get('access-control-expose-headers'),
    maxAge: response.headers.get('access-control-max-age')
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

  it('serves a custom directory index filename for /', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'app.html'), '<h1>custom-index</h1>');
    const app = createLiveServerApp(root, { indexFiles: ['app.html'] });
    const response = await get(app, '/');
    expect(response.status).toBe(200);
    expect(response.body).toContain('custom-index');
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

    const app = createLiveServerApp(root, {
      aliases: [{ path: '/assets', target: 'build/assets' }]
    });
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
    const app = createLiveServerApp(root, { corsSettings: defaultLiveServerCorsSettings() });
    const response = await requestWithCorsHeaders(app, '/', {
      headers: { Origin: 'http://example.com' }
    });
    expect(response.status).toBe(200);
    expect(response.allowOrigin).toBe('*');
  });

  it('omits CORS headers when CORS is disabled', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>no-cors</h1>');
    const app = createLiveServerApp(root, {
      corsSettings: {
        ...defaultLiveServerCorsSettings(),
        enabled: false
      }
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
    const app = createLiveServerApp(root, {
      corsSettings: {
        enabled: true,
        origin: 'http://example.com',
        methods: 'GET,OPTIONS',
        allowedHeaders: '*',
        exposedHeaders: '',
        maxAge: '',
        credentials: true
      }
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

  it('exposes headers and max-age on preflight when CORS extras are set', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>extras</h1>');
    const app = createLiveServerApp(root, {
      corsSettings: {
        enabled: true,
        origin: '*',
        methods: 'GET,OPTIONS',
        allowedHeaders: '*',
        exposedHeaders: 'X-Custom, Content-Length',
        maxAge: '600',
        credentials: false
      }
    });
    const response = await requestWithCorsHeaders(app, '/', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://example.com',
        'Access-Control-Request-Method': 'GET'
      }
    });
    expect(response.status).toBe(204);
    expect(response.exposeHeaders).toMatch(/X-Custom/i);
    expect(response.exposeHeaders).toMatch(/Content-Length/i);
    expect(response.maxAge).toBe('600');
  });

  it('sets custom response headers on 200 and 404', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>headers</h1>');
    const app = createLiveServerApp(root, {
      headers: [{ name: 'Cache-Control', value: 'no-store', enabled: true }]
    });
    const origin = await listen(app);

    const ok = await fetch(`${origin}/`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');

    const missing = await fetch(`${origin}/missing.txt`);
    expect(missing.status).toBe(404);
    expect(missing.headers.get('cache-control')).toBe('no-store');
  });

  it('skips disabled and empty-name response header rows', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>skip</h1>');
    const app = createLiveServerApp(root, {
      headers: [
        { name: 'X-Enabled', value: 'yes', enabled: true },
        { name: 'X-Disabled', value: 'no', enabled: false },
        { name: '', value: 'ignored', enabled: true },
        { name: '   ', value: 'also-ignored', enabled: true }
      ]
    });
    const origin = await listen(app);
    const response = await fetch(`${origin}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-enabled')).toBe('yes');
    expect(response.headers.get('x-disabled')).toBeNull();
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
    const app = createLiveServerApp(root, {
      corsSettings: defaultLiveServerCorsSettings(),
      onRequestLog: (fields) => {
        logs.push(fields);
      }
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
    const app = createLiveServerApp(root, {
      corsSettings: defaultLiveServerCorsSettings(),
      onRequestLog: (fields) => {
        logs.push({ statusCode: fields.statusCode, url: fields.url });
      }
    });
    const response = await get(app, '/missing.txt');
    expect(response.status).toBe(404);
    expect(logs).toEqual([{ statusCode: 404, url: '/missing.txt' }]);
  });

  it('falls back to index.html for missing paths when * route is configured', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>spa</h1>');
    fs.writeFileSync(path.join(root, 'app.js'), 'console.log("asset")');
    const app = createLiveServerApp(root, {
      routes: [{ match: '*', target: 'index.html' }]
    });
    const origin = await listen(app);

    const asset = await fetch(`${origin}/app.js`);
    expect(asset.status).toBe(200);
    expect(await asset.text()).toContain('asset');

    const deep = await fetch(`${origin}/about`);
    expect(deep.status).toBe(200);
    expect(await deep.text()).toContain('spa');
  });

  it('uses the first matching route before a catch-all', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>spa</h1>');
    fs.writeFileSync(path.join(root, 'legacy.html'), '<h1>legacy</h1>');
    const app = createLiveServerApp(root, {
      routes: [
        { match: '^/legacy', target: 'legacy.html' },
        { match: '*', target: 'index.html' }
      ]
    });
    const origin = await listen(app);

    const legacy = await fetch(`${origin}/legacy/page`);
    expect(legacy.status).toBe(200);
    expect(await legacy.text()).toContain('legacy');

    const other = await fetch(`${origin}/other`);
    expect(other.status).toBe(200);
    expect(await other.text()).toContain('spa');
  });

  it('serves nested files from a directory route target', async () => {
    const root = makeTempDir();
    const alt = path.join(root, 'alt-root');
    fs.mkdirSync(path.join(alt, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>root</h1>');
    fs.writeFileSync(path.join(alt, 'docs', 'guide.txt'), 'from-alt');
    const app = createLiveServerApp(root, {
      routes: [{ match: '^/docs/', target: 'alt-root' }]
    });
    const response = await get(app, '/docs/guide.txt');
    expect(response.status).toBe(200);
    expect(response.body).toContain('from-alt');
  });

  it('skips disabled routes and invalid regex matches', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>spa</h1>');
    fs.writeFileSync(path.join(root, 'other.html'), '<h1>other</h1>');
    const app = createLiveServerApp(root, {
      routes: [
        { match: '*', target: 'other.html', enabled: false },
        { match: '(unclosed', target: 'other.html' },
        { match: '*', target: 'index.html' }
      ]
    });
    const response = await get(app, '/missing');
    expect(response.status).toBe(200);
    expect(response.body).toContain('spa');
  });

  it('rejects path traversal via directory route targets', async () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>safe</h1>');
    const secret = path.join(root, '..', `secret-route-${path.basename(root)}.txt`);
    fs.writeFileSync(secret, 'secret');
    try {
      const app = createLiveServerApp(root, {
        routes: [{ match: '*', target: '.' }]
      });
      const response = await get(app, '/../' + path.basename(secret));
      expect(response.status).toBe(404);
      expect(response.body).not.toContain('secret');
    } finally {
      fs.rmSync(secret, { force: true });
    }
  });
});

describe('pathMatchesLiveServerRoute / isPathInsideDirectory', () => {
  it('matches * and valid regexes, rejects invalid regex', () => {
    expect(pathMatchesLiveServerRoute('/anything', '*')).toBe(true);
    expect(pathMatchesLiveServerRoute('/docs/a', '^/docs/')).toBe(true);
    expect(pathMatchesLiveServerRoute('/other', '^/docs/')).toBe(false);
    expect(pathMatchesLiveServerRoute('/x', '(unclosed')).toBe(false);
  });

  it('detects paths inside a directory', () => {
    const dir = path.resolve('/tmp/hc-route-root');
    expect(isPathInsideDirectory(path.join(dir, 'a.txt'), dir)).toBe(true);
    expect(isPathInsideDirectory(dir, dir)).toBe(true);
    expect(isPathInsideDirectory(path.resolve(dir, '..', 'outside.txt'), dir)).toBe(false);
  });
});

describe('toCorsOptions', () => {
  it('maps comma-separated origins and methods', () => {
    const options = toCorsOptions({
      enabled: true,
      origin: 'http://a.test, http://b.test',
      methods: 'GET, POST',
      allowedHeaders: 'Content-Type, Authorization',
      exposedHeaders: '',
      maxAge: '',
      credentials: false
    });
    expect(options.origin).toEqual(['http://a.test', 'http://b.test']);
    expect(options.methods).toEqual(['GET', 'POST']);
    expect(options.allowedHeaders).toEqual(['Content-Type', 'Authorization']);
    expect(options.credentials).toBe(false);
    expect(options.exposedHeaders).toBeUndefined();
    expect(options.maxAge).toBeUndefined();
  });

  it('maps exposedHeaders and maxAge when configured', () => {
    const options = toCorsOptions({
      enabled: true,
      origin: '*',
      methods: 'GET',
      allowedHeaders: '*',
      exposedHeaders: 'X-A, X-B',
      maxAge: '120',
      credentials: false
    });
    expect(options.exposedHeaders).toEqual(['X-A', 'X-B']);
    expect(options.maxAge).toBe(120);
  });

  it('maps exposedHeaders * and omits invalid maxAge', () => {
    const options = toCorsOptions({
      enabled: true,
      origin: '*',
      methods: 'GET',
      allowedHeaders: '*',
      exposedHeaders: '*',
      maxAge: 'not-a-number',
      credentials: false
    });
    expect(options.exposedHeaders).toBe('*');
    expect(options.maxAge).toBeUndefined();
  });
});
