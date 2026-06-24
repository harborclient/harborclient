import { describe, expect, it } from 'vitest';

describe('runScript', () => {
  it('returns passthrough for empty script', async () => {
    const { runScript } = await import('#/main/scripting/scripts');
    const request = {
      method: 'GET' as const,
      url: 'https://example.com',
      headers: [],
      params: [],
      body: '',
      bodyType: 'none' as const
    };

    const result = await runScript({
      phase: 'pre',
      script: '   ',
      request,
      variables: { host: 'example.com' }
    });

    expect(result).toEqual({
      request,
      variableSets: {},
      collectionVariableSets: {},
      environmentVariableSets: {},
      collectionHeaders: [],
      tests: [],
      logs: []
    });
  });

  it('mutates request url and sets variables in pre script', async () => {
    const { runScript } = await import('#/main/scripting/scripts');
    const result = await runScript({
      phase: 'pre',
      script: `
        hc.request.url = 'https://api.example.com';
        hc.variables.set('token', 'abc123');
        console.log('pre ran');
      `,
      request: {
        method: 'GET',
        url: 'https://old.example.com',
        headers: [{ key: 'X-Test', value: '1', enabled: true }],
        params: [],
        body: '',
        bodyType: 'none'
      },
      variables: { host: 'example.com' }
    });

    expect(result.error).toBeUndefined();
    expect(result.request.url).toBe('https://api.example.com');
    expect(result.variableSets).toEqual({ token: 'abc123' });
    expect(result.logs).toContain('pre ran');
  });

  it('sets collection variables in pre script', async () => {
    const { runScript } = await import('#/main/scripting/scripts');
    const result = await runScript({
      phase: 'pre',
      script: `
        hc.collection.variables.set('token', 'persist-me');
        hc.collection.variables.set('newKey', 'created');
        console.log(hc.collection.variables.get('host'));
      `,
      request: {
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        bodyType: 'none'
      },
      variables: { host: 'example.com', token: 'old' }
    });

    expect(result.error).toBeUndefined();
    expect(result.collectionVariableSets).toEqual({
      token: 'persist-me',
      newKey: 'created'
    });
    expect(result.variableSets).toEqual({});
    expect(result.logs).toContain('example.com');
  });

  it('reads collection variable overrides before runtime values', async () => {
    const { runScript } = await import('#/main/scripting/scripts');
    const result = await runScript({
      phase: 'pre',
      script: `
        hc.collection.variables.set('token', 'override');
        console.log(hc.collection.variables.get('token'));
      `,
      request: {
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        bodyType: 'none'
      },
      variables: { token: 'runtime' }
    });

    expect(result.error).toBeUndefined();
    expect(result.logs).toContain('override');
  });

  it('mutates collection headers and exposes collection metadata', async () => {
    const { runScript } = await import('#/main/scripting/scripts');
    const result = await runScript({
      phase: 'pre',
      script: `
        console.log(hc.collection.name);
        console.log(String(hc.collection.id));
        hc.collection.headers.upsert('Authorization', 'Bearer token');
        console.log(hc.collection.headers.get('Authorization'));
        console.log(JSON.stringify(hc.collection.headers.toObject()));
      `,
      request: {
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        bodyType: 'none'
      },
      variables: {},
      collection: {
        id: 42,
        name: 'My API',
        headers: [{ key: 'X-Api-Key', value: 'secret', enabled: true }]
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.logs).toContain('My API');
    expect(result.logs).toContain('42');
    expect(result.logs).toContain('Bearer token');
    expect(result.logs).toContain('{"X-Api-Key":"secret","Authorization":"Bearer token"}');
    expect(result.collectionHeaders).toEqual([
      { key: 'X-Api-Key', value: 'secret', enabled: true },
      { key: 'Authorization', value: 'Bearer token', enabled: true }
    ]);
  });

  it('returns null collection metadata when no collection is passed', async () => {
    const { runScript } = await import('#/main/scripting/scripts');
    const result = await runScript({
      phase: 'pre',
      script: `
        console.log(hc.collection.name);
        console.log(String(hc.collection.id));
      `,
      request: {
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        bodyType: 'none'
      },
      variables: {}
    });

    expect(result.error).toBeUndefined();
    expect(result.logs).toContain('');
    expect(result.logs).toContain('null');
    expect(result.collectionHeaders).toEqual([]);
  });

  it('sets environment variables and exposes environment name', async () => {
    const { runScript } = await import('#/main/scripting/scripts');
    const result = await runScript({
      phase: 'pre',
      script: `
        console.log(hc.environment.name);
        hc.environment.variables.set('token', 'persist-env');
        hc.environment.variables.set('newKey', 'created');
        console.log(hc.environment.variables.get('host'));
      `,
      request: {
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        bodyType: 'none'
      },
      variables: { host: 'example.com', token: 'old' },
      environment: { name: 'Production' }
    });

    expect(result.error).toBeUndefined();
    expect(result.logs).toContain('Production');
    expect(result.environmentVariableSets).toEqual({
      token: 'persist-env',
      newKey: 'created'
    });
    expect(result.variableSets).toEqual({});
    expect(result.logs).toContain('example.com');
  });

  it('returns empty environment name when no environment is passed', async () => {
    const { runScript } = await import('#/main/scripting/scripts');
    const result = await runScript({
      phase: 'pre',
      script: `
        console.log(hc.environment.name);
        hc.environment.variables.set('token', 'ephemeral');
      `,
      request: {
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        bodyType: 'none'
      },
      variables: {}
    });

    expect(result.error).toBeUndefined();
    expect(result.logs).toContain('');
    expect(result.environmentVariableSets).toEqual({ token: 'ephemeral' });
  });

  it('runs post script tests against response', async () => {
    const { runScript } = await import('#/main/scripting/scripts');
    const result = await runScript({
      phase: 'post',
      script: `
        hc.test('status is 200', function() {
          hc.expect(hc.response.code).to.equal(200);
        });
        hc.test('body has ok', function() {
          hc.expect(hc.response.json()).to.eql({ ok: true });
        });
      `,
      request: {
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        bodyType: 'none'
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"ok":true}',
        timeMs: 42,
        sizeBytes: 11
      },
      variables: {}
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toEqual([
      { name: 'status is 200', passed: true },
      { name: 'body has ok', passed: true }
    ]);
  });

  it('returns scriptError when sandbox script throws', async () => {
    const { runScript } = await import('#/main/scripting/scripts');
    const request = {
      method: 'GET' as const,
      url: 'https://example.com',
      headers: [],
      params: [],
      body: '',
      bodyType: 'none' as const
    };

    const result = await runScript({
      phase: 'pre',
      script: 'throw new Error("boom");',
      request,
      variables: {}
    });

    expect(result.error).toContain('boom');
    expect(result.request).toEqual(request);
  });

  it('sanitizes filesystem paths from script errors', async () => {
    const { runScript } = await import('#/main/scripting/scripts');
    const request = {
      method: 'GET' as const,
      url: 'https://example.com',
      headers: [],
      params: [],
      body: '',
      bodyType: 'none' as const
    };

    const result = await runScript({
      phase: 'pre',
      script: 'throw new Error("ENOENT: /home/user/secret/project/file.js");',
      request,
      variables: {}
    });

    expect(result.error).toContain('[path]');
    expect(result.error).not.toContain('/home/user');
    expect(result.error).not.toContain('file.js');
  });

  it('runs modern JavaScript syntax after esbuild transpile', async () => {
    const { runScript } = await import('#/main/scripting/scripts');
    const result = await runScript({
      phase: 'pre',
      script: `
        const host = hc.variables.get('host');
        const { token = 'default' } = { token: 'abc123' };
        const buildUrl = (base, path) => \`\${base}/\${path}\`;
        const maybeHost = host?.toUpperCase?.() ?? 'UNKNOWN';
        hc.request.url = buildUrl('https://api.example.com', 'v1/status');
        hc.variables.set('token', token);
        hc.variables.set('hostUpper', maybeHost);
        console.log(...['modern', 'syntax']);
      `,
      request: {
        method: 'GET',
        url: 'https://old.example.com',
        headers: [],
        params: [],
        body: '',
        bodyType: 'none'
      },
      variables: { host: 'example.com' }
    });

    expect(result.error).toBeUndefined();
    expect(result.request.url).toBe('https://api.example.com/v1/status');
    expect(result.variableSets).toEqual({ token: 'abc123', hostUpper: 'EXAMPLE.COM' });
    expect(result.logs).toContain('modern syntax');
  });

  it('returns compile error for invalid modern syntax', async () => {
    const { runScript } = await import('#/main/scripting/scripts');
    const request = {
      method: 'GET' as const,
      url: 'https://example.com',
      headers: [],
      params: [],
      body: '',
      bodyType: 'none' as const
    };

    const result = await runScript({
      phase: 'pre',
      script: 'const x = ;',
      request,
      variables: {}
    });

    expect(result.error).toBeDefined();
    expect(result.error?.length).toBeGreaterThan(0);
    expect(result.request).toEqual(request);
  });
});
