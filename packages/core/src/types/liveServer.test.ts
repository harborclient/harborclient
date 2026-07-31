import { describe, expect, it } from 'vitest';
import {
  defaultLiveServerCorsSettings,
  defaultLiveServerIndexFiles,
  defaultLiveServerRoutes,
  defaultLiveServerSslSettings,
  isLiveServerLoopbackHost,
  joinLiveServerOriginPath,
  liveServerOpenedPathFromUrl,
  normalizeLiveServerConfigFields,
  normalizeLiveServerCorsSettings,
  normalizeLiveServerHeaders,
  normalizeLiveServerHost,
  normalizeLiveServerIndexFiles,
  normalizeLiveServerLastOpenedPath,
  normalizeLiveServerOpenPath,
  normalizeLiveServerRoutes,
  normalizeLiveServerSslSettings,
  resolveLiveServerHomeUrl,
  resolveLiveServerOpenUrl
} from './liveServer';

describe('defaultLiveServerCorsSettings', () => {
  it('includes empty exposedHeaders and maxAge', () => {
    expect(defaultLiveServerCorsSettings()).toMatchObject({
      enabled: true,
      origin: '*',
      exposedHeaders: '',
      maxAge: '',
      credentials: false
    });
  });
});

describe('normalizeLiveServerCorsSettings', () => {
  it('fills defaults for null/undefined and legacy payloads without new fields', () => {
    expect(normalizeLiveServerCorsSettings(undefined)).toEqual(defaultLiveServerCorsSettings());
    expect(normalizeLiveServerCorsSettings(null)).toEqual(defaultLiveServerCorsSettings());
    expect(
      normalizeLiveServerCorsSettings({
        enabled: true,
        origin: 'https://example.com',
        methods: 'GET',
        allowedHeaders: 'X-Test',
        credentials: true
      })
    ).toEqual({
      enabled: true,
      origin: 'https://example.com',
      methods: 'GET',
      allowedHeaders: 'X-Test',
      exposedHeaders: '',
      maxAge: '',
      credentials: true
    });
  });

  it('trims exposedHeaders and maxAge strings', () => {
    expect(
      normalizeLiveServerCorsSettings({
        exposedHeaders: '  X-Custom, *  ',
        maxAge: '  600  '
      })
    ).toMatchObject({
      exposedHeaders: 'X-Custom, *',
      maxAge: '600'
    });
  });

  it('falls back when exposedHeaders/maxAge are non-strings', () => {
    expect(
      normalizeLiveServerCorsSettings({
        // @ts-expect-error intentional corrupt input
        exposedHeaders: 42,
        // @ts-expect-error intentional corrupt input
        maxAge: { seconds: 10 }
      })
    ).toMatchObject({
      exposedHeaders: '',
      maxAge: ''
    });
  });
});

describe('defaultLiveServerSslSettings / normalizeLiveServerSslSettings', () => {
  it('defaults to disabled with empty paths', () => {
    expect(defaultLiveServerSslSettings()).toEqual({
      enabled: false,
      certPath: '',
      keyPath: ''
    });
  });

  it('normalizes partial SSL settings', () => {
    expect(normalizeLiveServerSslSettings(undefined)).toEqual(defaultLiveServerSslSettings());
    expect(
      normalizeLiveServerSslSettings({
        enabled: true,
        certPath: '  /tmp/cert.pem  ',
        keyPath: ' /tmp/key.pem '
      })
    ).toEqual({
      enabled: true,
      certPath: '/tmp/cert.pem',
      keyPath: '/tmp/key.pem'
    });
    expect(normalizeLiveServerSslSettings({ enabled: false, certPath: 'x' })).toMatchObject({
      enabled: false
    });
  });
});

describe('normalizeLiveServerIndexFiles', () => {
  it('returns the default list for empty or invalid input', () => {
    expect(defaultLiveServerIndexFiles()).toEqual(['index.html']);
    expect(normalizeLiveServerIndexFiles(undefined)).toEqual(['index.html']);
    expect(normalizeLiveServerIndexFiles(null)).toEqual(['index.html']);
    expect(normalizeLiveServerIndexFiles('')).toEqual(['index.html']);
    expect(normalizeLiveServerIndexFiles('  ,  , ')).toEqual(['index.html']);
    expect(normalizeLiveServerIndexFiles([])).toEqual(['index.html']);
    expect(normalizeLiveServerIndexFiles(['', '  '])).toEqual(['index.html']);
  });

  it('accepts arrays and comma-separated strings', () => {
    expect(normalizeLiveServerIndexFiles(['index.htm', 'app.html'])).toEqual([
      'index.htm',
      'app.html'
    ]);
    expect(normalizeLiveServerIndexFiles(' index.html , index.htm , app.html ')).toEqual([
      'index.html',
      'index.htm',
      'app.html'
    ]);
  });
});

describe('normalizeLiveServerOpenPath', () => {
  it('defaults empty values to / and prefixes a leading slash', () => {
    expect(normalizeLiveServerOpenPath(undefined)).toBe('/');
    expect(normalizeLiveServerOpenPath('')).toBe('/');
    expect(normalizeLiveServerOpenPath('   ')).toBe('/');
    expect(normalizeLiveServerOpenPath('/docs/')).toBe('/docs/');
    expect(normalizeLiveServerOpenPath('preview.html')).toBe('/preview.html');
    expect(normalizeLiveServerOpenPath('  docs/foo  ')).toBe('/docs/foo');
  });
});

describe('normalizeLiveServerLastOpenedPath', () => {
  it('returns null for empty/invalid and normalizes non-empty paths', () => {
    expect(normalizeLiveServerLastOpenedPath(undefined)).toBeNull();
    expect(normalizeLiveServerLastOpenedPath(null)).toBeNull();
    expect(normalizeLiveServerLastOpenedPath('')).toBeNull();
    expect(normalizeLiveServerLastOpenedPath('   ')).toBeNull();
    expect(normalizeLiveServerLastOpenedPath(12)).toBeNull();
    expect(normalizeLiveServerLastOpenedPath('/docs/foo?x=1#y')).toBe('/docs/foo?x=1#y');
    expect(normalizeLiveServerLastOpenedPath('docs/foo')).toBe('/docs/foo');
  });
});

describe('normalizeLiveServerHost', () => {
  it('defaults empty values to 127.0.0.1', () => {
    expect(normalizeLiveServerHost(undefined)).toBe('127.0.0.1');
    expect(normalizeLiveServerHost('')).toBe('127.0.0.1');
    expect(normalizeLiveServerHost('  ')).toBe('127.0.0.1');
    expect(normalizeLiveServerHost('0.0.0.0')).toBe('0.0.0.0');
    expect(normalizeLiveServerHost('  localhost  ')).toBe('localhost');
  });
});

describe('normalizeLiveServerHeaders', () => {
  it('returns [] for non-arrays and skips corrupt entries', () => {
    expect(normalizeLiveServerHeaders(undefined)).toEqual([]);
    expect(normalizeLiveServerHeaders(null)).toEqual([]);
    expect(normalizeLiveServerHeaders('nope')).toEqual([]);
    expect(
      normalizeLiveServerHeaders([
        null,
        42,
        { name: '  Cache-Control  ', value: 'no-store' },
        { name: 'X-Empty', value: '', enabled: false },
        { value: 'orphan' },
        { name: 'X-Keep', value: '1', enabled: true }
      ])
    ).toEqual([
      { name: 'Cache-Control', value: 'no-store', enabled: true },
      { name: 'X-Empty', value: '', enabled: false },
      { name: '', value: 'orphan', enabled: true },
      { name: 'X-Keep', value: '1', enabled: true }
    ]);
  });
});

describe('normalizeLiveServerRoutes', () => {
  it('returns [] for non-arrays and drops empty/corrupt rows', () => {
    expect(normalizeLiveServerRoutes(undefined)).toEqual([]);
    expect(normalizeLiveServerRoutes(null)).toEqual([]);
    expect(normalizeLiveServerRoutes('nope')).toEqual([]);
    expect(defaultLiveServerRoutes()).toEqual([]);
    expect(
      normalizeLiveServerRoutes([
        null,
        42,
        { match: '', target: 'index.html' },
        { match: '*', target: '' },
        { match: '  *  ', target: '  index.html  ' },
        { match: '^/docs/', target: 'docs', enabled: false },
        { target: 'orphan' },
        { match: '^/api/', target: 'mocks', enabled: true }
      ])
    ).toEqual([
      { match: '*', target: 'index.html', enabled: true },
      { match: '^/docs/', target: 'docs', enabled: false },
      { match: '^/api/', target: 'mocks', enabled: true }
    ]);
  });
});

describe('isLiveServerLoopbackHost', () => {
  it('recognizes loopback hosts case-insensitively for localhost', () => {
    expect(isLiveServerLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLiveServerLoopbackHost('::1')).toBe(true);
    expect(isLiveServerLoopbackHost('localhost')).toBe(true);
    expect(isLiveServerLoopbackHost('LocalHost')).toBe(true);
    expect(isLiveServerLoopbackHost('  localhost  ')).toBe(true);
    expect(isLiveServerLoopbackHost('0.0.0.0')).toBe(false);
    expect(isLiveServerLoopbackHost('192.168.1.10')).toBe(false);
  });
});

describe('normalizeLiveServerConfigFields', () => {
  it('applies defaults when value is missing', () => {
    expect(normalizeLiveServerConfigFields(undefined)).toEqual({
      openPath: '/',
      rememberLastUrl: false,
      lastOpenedPath: null,
      indexFiles: ['index.html'],
      host: '127.0.0.1',
      headers: [],
      routes: [],
      ssl: defaultLiveServerSslSettings()
    });
  });

  it('normalizes a partial legacy-shaped payload', () => {
    expect(
      normalizeLiveServerConfigFields({
        openPath: 'app.html',
        rememberLastUrl: true,
        lastOpenedPath: 'docs/?q=1',
        indexFiles: 'index.htm, app.html',
        host: '0.0.0.0',
        headers: [{ name: 'COOP', value: 'same-origin' }],
        routes: [{ match: '*', target: 'index.html' }],
        ssl: { enabled: true, certPath: '/c.pem', keyPath: '/k.pem' }
      })
    ).toEqual({
      openPath: '/app.html',
      rememberLastUrl: true,
      lastOpenedPath: '/docs/?q=1',
      indexFiles: ['index.htm', 'app.html'],
      host: '0.0.0.0',
      headers: [{ name: 'COOP', value: 'same-origin', enabled: true }],
      routes: [{ match: '*', target: 'index.html', enabled: true }],
      ssl: { enabled: true, certPath: '/c.pem', keyPath: '/k.pem' }
    });
  });
});

describe('resolveLiveServerOpenUrl / resolveLiveServerHomeUrl', () => {
  const origin = 'http://127.0.0.1:5500';

  it('uses openPath when remember is off', () => {
    expect(
      resolveLiveServerOpenUrl(origin, {
        openPath: '/preview.html',
        rememberLastUrl: false,
        lastOpenedPath: '/docs/foo'
      })
    ).toBe('http://127.0.0.1:5500/preview.html');
  });

  it('uses lastOpenedPath when remember is on and a path is stored', () => {
    expect(
      resolveLiveServerOpenUrl(origin, {
        openPath: '/',
        rememberLastUrl: true,
        lastOpenedPath: '/docs/foo?q=1#h'
      })
    ).toBe('http://127.0.0.1:5500/docs/foo?q=1#h');
  });

  it('falls back to openPath when remember is on but lastOpenedPath is null', () => {
    expect(
      resolveLiveServerOpenUrl(origin, {
        openPath: 'app.html',
        rememberLastUrl: true,
        lastOpenedPath: null
      })
    ).toBe('http://127.0.0.1:5500/app.html');
  });

  it('strips a trailing slash on origin before joining', () => {
    expect(joinLiveServerOriginPath('http://127.0.0.1:5500/', '/docs')).toBe(
      'http://127.0.0.1:5500/docs'
    );
  });

  it('builds homeUrl from openPath only (not the remembered deep link)', () => {
    expect(resolveLiveServerHomeUrl(origin, '/preview.html')).toBe(
      'http://127.0.0.1:5500/preview.html'
    );
  });
});

describe('liveServerOpenedPathFromUrl', () => {
  it('returns pathname+search+hash when origins match', () => {
    expect(
      liveServerOpenedPathFromUrl(
        'http://127.0.0.1:5500/docs/foo?q=1#section',
        'http://127.0.0.1:5500'
      )
    ).toBe('/docs/foo?q=1#section');
  });

  it('returns null when origins differ (including port)', () => {
    expect(
      liveServerOpenedPathFromUrl('http://127.0.0.1:5501/docs', 'http://127.0.0.1:5500')
    ).toBeNull();
    expect(
      liveServerOpenedPathFromUrl('https://127.0.0.1:5500/docs', 'http://127.0.0.1:5500')
    ).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(liveServerOpenedPathFromUrl('not-a-url', 'http://127.0.0.1:5500')).toBeNull();
  });
});
