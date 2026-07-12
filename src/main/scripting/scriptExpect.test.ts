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

describe('hc.expect via Chai in script sandbox', () => {
  it('supports backwards-compatible .to.equal, .to.eql, and .to.include', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('status is 200', function() {
          hc.expect(hc.response.code).to.equal(200);
        });
        hc.test('body has ok', function() {
          hc.expect(hc.response.json()).to.eql({ ok: true, items: ['a', 'b'] });
        });
        hc.test('body text includes ok', function() {
          hc.expect(hc.response.text()).to.include('"ok":true');
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toEqual([
      { name: 'status is 200', passed: true },
      { name: 'body has ok', passed: true },
      { name: 'body text includes ok', passed: true }
    ]);
  });

  it('uses Chai deep equality for .to.deep.equal with reordered keys', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('deep equal ignores key order', function() {
          hc.expect({ b: 2, a: 1 }).to.deep.equal({ a: 1, b: 2 });
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toEqual([{ name: 'deep equal ignores key order', passed: true }]);
  });

  it('supports .to.be.oneOf and .to.be.a type checks', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('status is one of allowed codes', function() {
          hc.expect(hc.response.code).to.be.oneOf([200, 201, 204]);
        });
        hc.test('status text is a string', function() {
          hc.expect(hc.response.status).to.be.a('string');
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toEqual([
      { name: 'status is one of allowed codes', passed: true },
      { name: 'status text is a string', passed: true }
    ]);
  });

  it('supports .to.include on arrays', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('items include a', function() {
          hc.expect(hc.response.json().items).to.include('a');
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toEqual([{ name: 'items include a', passed: true }]);
  });

  it('supports custom failure messages via hc.expect(actual, message)', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('custom message on failure', function() {
          hc.expect(hc.response.code, 'expected 200 status').to.equal(404);
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toHaveLength(1);
    expect(result.tests[0]?.passed).toBe(false);
    expect(result.tests[0]?.error).toContain('expected 200 status');
  });

  it('records Chai assertion errors in test results', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('failing assertion', function() {
          hc.expect(hc.response.code).to.equal(404);
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toHaveLength(1);
    expect(result.tests[0]?.passed).toBe(false);
    expect(result.tests[0]?.error).toBeTruthy();
    expect(result.tests[0]?.error).toContain('404');
  });

  it('supports .to.be.ok property assertion', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('response code is ok', function() {
          hc.expect(hc.response.code).to.be.ok;
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toEqual([{ name: 'response code is ok', passed: true }]);
  });

  it('supports callable property assertions with trailing parentheses', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('response time is recorded', function() {
          hc.expect(hc.response.responseTime >= 0).to.be.ok();
        });
        hc.test('response headers exist', function() {
          hc.expect(hc.response.headers).to.be.ok();
        });
        hc.test('response body is readable', function() {
          hc.expect(typeof hc.response.text()).to.equal('string');
        });
        hc.test('json body parses when applicable', function() {
          hc.expect(hc.response.json()).to.be.ok();
        });
        hc.test('exist callable', function() {
          hc.expect(hc.response.headers).to.exist();
        });
        hc.test('true callable', function() {
          hc.expect(true).to.be.true();
        });
        hc.test('empty callable on non-empty array', function() {
          hc.expect([1]).to.not.be.empty();
        });
        hc.test('negated ok callable', function() {
          hc.expect(false).to.not.be.ok();
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests?.every((test) => test.passed)).toBe(true);
  });

  it('supports .to.have.property', async () => {
    const result = await evaluateScript({
      ...basePostInput,
      script: `
        hc.test('body has ok property', function() {
          hc.expect(hc.response.json()).to.have.property('ok', true);
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toEqual([{ name: 'body has ok property', passed: true }]);
  });
});
