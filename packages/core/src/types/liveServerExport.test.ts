import { describe, expect, it } from 'vitest';
import {
  buildLiveServerExport,
  defaultLiveServerCorsSettings,
  validateLiveServerExport
} from './liveServer';

describe('buildLiveServerExport', () => {
  it('builds a live-server export envelope', () => {
    const envelope = buildLiveServerExport({
      uuid: '11111111-1111-4111-8111-111111111111',
      name: 'Docs',
      root: '/var/www/docs',
      port: 5500,
      aliases: [{ path: '/assets', target: '/var/www/assets' }],
      watch: true,
      cors: defaultLiveServerCorsSettings(),
      openPath: '/index.html',
      openPathOnStartup: false,
      rememberLastUrl: true,
      lastOpenedPath: '/about',
      indexFiles: ['index.html'],
      host: '127.0.0.1',
      headers: [{ name: 'X-Test', value: '1', enabled: true }],
      routes: [{ match: '*', target: 'index.html' }],
      errorPages: [{ code: '404', path: '404.html' }],
      proxies: [{ path: '/api', target: 'http://127.0.0.1:3000' }],
      ssl: { enabled: false, certPath: '', keyPath: '' },
      runCommand: '/usr/bin/npm start',
      runCommandEnabled: true,
      restartOnCrash: true,
      urlVariable: 'LIVE_SERVER_URL',
      preRequestScripts: [
        {
          id: 'p1',
          enabled: true,
          kind: 'inline',
          name: 'Pre',
          code: 'hc.log("pre")',
          stage: 'main',
          matchPath: 'index.html'
        }
      ]
    });

    expect(envelope).toMatchObject({
      harborclientVersion: 1,
      harborclientExport: 'server',
      uuid: '11111111-1111-4111-8111-111111111111',
      name: 'Docs',
      root: '/var/www/docs',
      port: 5500,
      watch: true,
      openPath: '/index.html',
      openPathOnStartup: false,
      rememberLastUrl: true,
      lastOpenedPath: '/about',
      host: '127.0.0.1',
      runCommand: '/usr/bin/npm start',
      runCommandEnabled: true,
      restartOnCrash: true,
      urlVariable: 'LIVE_SERVER_URL'
    });
    expect(envelope.aliases).toHaveLength(1);
    expect(envelope.headers).toHaveLength(1);
    expect(envelope.routes).toHaveLength(1);
    expect(envelope.errorPages).toHaveLength(1);
    expect(envelope.proxies).toHaveLength(1);
    expect(envelope.pre_request_scripts).toHaveLength(1);
  });

  it('omits empty optional arrays and blank strings', () => {
    const envelope = buildLiveServerExport({
      uuid: '11111111-1111-4111-8111-111111111111',
      name: 'Minimal',
      root: '/tmp/site',
      port: null
    });

    expect(envelope.port).toBeNull();
    expect(envelope.aliases).toBeUndefined();
    expect(envelope.headers).toBeUndefined();
    expect(envelope.routes).toBeUndefined();
    expect(envelope.errorPages).toBeUndefined();
    expect(envelope.proxies).toBeUndefined();
    expect(envelope.runCommand).toBeUndefined();
    expect(envelope.urlVariable).toBeUndefined();
    expect(envelope.pre_request_scripts).toBeUndefined();
    expect(envelope.post_request_scripts).toBeUndefined();
  });

  it('includes null lastOpenedPath when provided', () => {
    const envelope = buildLiveServerExport({
      uuid: '11111111-1111-4111-8111-111111111111',
      name: 'Minimal',
      root: '/tmp/site',
      port: null,
      lastOpenedPath: null
    });

    expect(envelope.lastOpenedPath).toBeNull();
  });

  it('includes portable runtime requirement and runCommandEnv when set', () => {
    const envelope = buildLiveServerExport({
      uuid: '11111111-1111-4111-8111-111111111111',
      name: 'With runtime',
      root: '/tmp/site',
      port: 3000,
      runCommand: 'server.js -p 3000',
      runtime: { kind: 'node', version: '22.14.0', name: 'Node v22' },
      runCommandEnv: [
        { key: 'NODE_ENV', value: 'development', enabled: true },
        { key: 'SKIP', value: 'x', enabled: false }
      ]
    });

    expect(envelope.runtime).toEqual({
      kind: 'node',
      version: '22.14',
      name: 'Node v22'
    });
    expect(envelope.runCommandEnv).toEqual([
      { key: 'NODE_ENV', value: 'development', enabled: true },
      { key: 'SKIP', value: 'x', enabled: false }
    ]);
    expect(envelope.runCommand).toBe('server.js -p 3000');
  });

  it('omits runtime and runCommandEnv when empty', () => {
    const envelope = buildLiveServerExport({
      uuid: '11111111-1111-4111-8111-111111111111',
      name: 'Minimal',
      root: '/tmp/site',
      port: null,
      runCommandEnv: []
    });

    expect(envelope.runtime).toBeUndefined();
    expect(envelope.runCommandEnv).toBeUndefined();
  });
});

describe('validateLiveServerExport', () => {
  it('accepts a valid live-server export', () => {
    const exportData = validateLiveServerExport({
      harborclientVersion: 1,
      harborclientExport: 'server',
      uuid: '11111111-1111-4111-8111-111111111111',
      name: 'Docs',
      root: '/var/www/docs',
      port: 5500,
      pre_request_scripts: []
    });

    expect(exportData.harborclientExport).toBe('server');
    expect(exportData.name).toBe('Docs');
  });

  it('accepts optional runtime and runCommandEnv fields', () => {
    const exportData = validateLiveServerExport({
      harborclientVersion: 1,
      harborclientExport: 'server',
      uuid: '11111111-1111-4111-8111-111111111111',
      name: 'Docs',
      root: '/var/www/docs',
      port: 5500,
      runCommand: 'server.js',
      runtime: { kind: 'php', version: '8.3', name: 'PHP 8.3' },
      runCommandEnv: [{ key: 'APP_ENV', value: 'local', enabled: true }]
    });

    expect(exportData.runtime).toEqual({
      kind: 'php',
      version: '8.3',
      name: 'PHP 8.3'
    });
    expect(exportData.runCommandEnv).toHaveLength(1);
  });

  it('rejects an unknown discriminator', () => {
    expect(() =>
      validateLiveServerExport({
        harborclientVersion: 1,
        harborclientExport: 'website',
        uuid: '11111111-1111-4111-8111-111111111111',
        name: 'Docs',
        root: '/var/www/docs',
        port: null
      })
    ).toThrow();
  });
});
