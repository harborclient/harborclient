import { describe, expect, it } from 'vitest';

describe('runScript', () => {
  it('returns passthrough for empty script', async () => {
    const { runScript } = await import('#/main/scripts');
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
      tests: [],
      logs: []
    });
  });

  it('mutates request url and sets variables in pre script', async () => {
    const { runScript } = await import('#/main/scripts');
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

  it('runs post script tests against response', async () => {
    const { runScript } = await import('#/main/scripts');
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
    const { runScript } = await import('#/main/scripts');
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
    const { runScript } = await import('#/main/scripts');
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
});
