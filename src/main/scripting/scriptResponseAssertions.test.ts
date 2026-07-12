import { describe, expect, it } from 'vitest';
import { evaluateScript } from '#/main/scripting/scriptEvaluator';

const basePostInput = {
  phase: 'post' as const,
  request: {
    method: 'GET' as const,
    url: 'https://example.com',
    headers: [],
    params: [],
    body: '',
    bodyType: 'none' as const
  },
  response: {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"ok":true,"items":["a","b"]}',
    timeMs: 42,
    sizeBytes: 28
  },
  variables: {}
};

describe('hc.response.to response assertion plugin', () => {
  it('passes status(200) and status("OK") matchers', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('status code', function() {
          hc.response.to.have.status(200);
        });
        hc.test('status text', function() {
          hc.response.to.have.status('OK');
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toEqual([
      { name: 'status code', passed: true },
      { name: 'status text', passed: true }
    ]);
  });

  it('records failure for status(404)', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('wrong status', function() {
          hc.response.to.have.status(404);
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests[0]?.passed).toBe(false);
    expect(result.tests[0]?.error).toContain('404');
  });

  it('supports negated status matcher', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('not 404', function() {
          hc.response.to.not.have.status(404);
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toEqual([{ name: 'not 404', passed: true }]);
  });

  it('passes header presence and header value matchers', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('has content-type', function() {
          hc.response.to.have.header('content-type');
        });
        hc.test('content-type value', function() {
          hc.response.to.have.header('content-type', 'application/json');
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toEqual([
      { name: 'has content-type', passed: true },
      { name: 'content-type value', passed: true }
    ]);
  });

  it('passes be.json, withBody, body, and body regex matchers', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('is json', function() {
          hc.response.to.be.json;
        });
        hc.test('has body', function() {
          hc.response.to.be.withBody;
        });
        hc.test('body exact', function() {
          hc.response.to.have.body('{"ok":true,"items":["a","b"]}');
        });
        hc.test('body regex', function() {
          hc.response.to.have.body(/"ok":\\s*true/);
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests.every((test) => test.passed)).toBe(true);
  });

  it('passes jsonBody() and jsonBody(expected) matchers', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('valid json body', function() {
          hc.response.to.have.jsonBody();
        });
        hc.test('json body shape', function() {
          hc.response.to.have.jsonBody({ ok: true, items: ['a', 'b'] });
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toEqual([
      { name: 'valid json body', passed: true },
      { name: 'json body shape', passed: true }
    ]);
  });

  it('passes status class properties', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('success', function() { hc.response.to.be.success; });
        hc.test('ok', function() { hc.response.to.be.ok; });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests.every((test) => test.passed)).toBe(true);
  });

  it('passes status class properties with callable syntax', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('success callable', function() { hc.response.to.be.success(); });
        hc.test('ok callable', function() { hc.response.to.be.ok(); });
        hc.test('json callable', function() { hc.response.to.be.json(); });
        hc.test('withBody callable', function() { hc.response.to.be.withBody(); });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests.every((test) => test.passed)).toBe(true);
  });

  it('passes clientError and notFound for 404 responses', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      response: {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'text/plain' },
        body: 'missing',
        timeMs: 10,
        sizeBytes: 7
      },
      script: `
        hc.test('client error', function() { hc.response.to.be.clientError; });
        hc.test('not found', function() { hc.response.to.be.notFound; });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests.every((test) => test.passed)).toBe(true);
  });

  it('passes unauthorized for 401 responses', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      response: {
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        body: '',
        timeMs: 5,
        sizeBytes: 0
      },
      script: `
        hc.test('unauthorized', function() { hc.response.to.be.unauthorized; });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toEqual([{ name: 'unauthorized', passed: true }]);
  });

  it('rejects response matchers on hc.expect subjects', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('scope guard', function() {
          hc.expect(5).to.have.status(200);
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests[0]?.passed).toBe(false);
    expect(result.tests[0]?.error).toContain('hc.response');
  });
});
