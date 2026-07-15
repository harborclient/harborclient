import { describe, expect, it } from 'vitest';
import { createScriptContext } from './pluginScriptContext';

describe('createScriptContext', () => {
  it('returns the last-expression value from run()', () => {
    const context = createScriptContext({
      variables: { foo: 'bar' }
    });
    context.setVariable('threshold', 5);

    const result = context.run(`
      threshold + 1;
    `);

    expect(result.error).toBeUndefined();
    expect(result.value).toBe(6);
  });

  it('supports return statements in user scripts', () => {
    const context = createScriptContext();

    const result = context.run(`
      return { foo: 'bar' };
    `);

    expect(result.error).toBeUndefined();
    expect(result.value).toEqual({ foo: 'bar' });
  });

  it('exposes hc.request.variables and hc.globals like pre/post scripts', () => {
    const context = createScriptContext({
      variables: { host: 'example.com' }
    });

    const result = context.run(`
      hc.request.variables.set('token', 'abc');
      hc.globals.set('baseUrl', 'https://api.example.com');
      hc.request.variables.get('host');
    `);

    expect(result.error).toBeUndefined();
    expect(result.value).toBe('example.com');
    expect(result.variableSets).toEqual({ token: 'abc' });
    expect(result.globalVariableSets).toEqual({ baseUrl: 'https://api.example.com' });
  });

  it('records hc.test and hc.expect results from post-style response context', () => {
    const context = createScriptContext({
      phase: 'post',
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
        timeMs: 12,
        sizeBytes: 11
      },
      variables: {}
    });

    const result = context.run(`
      const data = hc.response.json();
      hc.test('status is 200', function() {
        hc.expect(hc.response.code).to.equal(200);
      });
      hc.test('body has ok', function() {
        hc.expect(data.ok).to.equal(true);
      });
      data.ok;
    `);

    expect(result.error).toBeUndefined();
    expect(result.value).toBe(true);
    expect(result.tests).toEqual([
      { name: 'status is 200', passed: true },
      { name: 'body has ok', passed: true }
    ]);
  });

  it('mutates hc.request and persists across multiple run() calls', () => {
    const context = createScriptContext({
      request: {
        method: 'GET',
        url: 'https://old.example.com',
        headers: [],
        params: [],
        body: '',
        bodyType: 'none'
      },
      variables: {}
    });

    context.run(`hc.request.url = 'https://api.example.com';`);
    const result = context.run(`hc.request.url;`);

    expect(result.error).toBeUndefined();
    expect(result.value).toBe('https://api.example.com');
    expect(result.request.url).toBe('https://api.example.com');
  });

  it('captures console output by default', () => {
    const context = createScriptContext({ variables: {} });

    const result = context.run(`
      console.log('hello', 'world');
      console.error('oops');
      'done';
    `);

    expect(result.error).toBeUndefined();
    expect(result.value).toBe('done');
    expect(result.logs).toEqual(['hello world', '[error] oops']);
  });

  it('allows injected globals to override console', () => {
    const context = createScriptContext({ variables: {} });
    const lines: string[] = [];
    context.setVariable('console', {
      log: (...args: unknown[]) => {
        lines.push(String(args[0]));
      },
      error: (...args: unknown[]) => {
        lines.push(`err:${String(args[0])}`);
      }
    });

    const result = context.run(`
      console.log('plugin');
      console.error('fail');
      'ok';
    `);

    expect(result.error).toBeUndefined();
    expect(result.value).toBe('ok');
    expect(lines).toEqual(['plugin', 'err:fail']);
    expect(result.logs).toEqual([]);
  });

  it('returns sanitized error when script throws', () => {
    const context = createScriptContext({ variables: {} });

    const result = context.run(`throw new Error('boom');`);

    expect(result.error).toContain('boom');
    expect(result.value).toBeUndefined();
  });

  it('accumulates tests and logs across multiple run() calls', () => {
    const context = createScriptContext({
      phase: 'post',
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
        headers: {},
        body: '{}',
        timeMs: 1,
        sizeBytes: 2
      },
      variables: {}
    });

    context.run(`
      console.log('first');
      hc.test('first test', function() { hc.expect(true).to.be.ok; });
    `);
    const result = context.run(`
      console.log('second');
      hc.test('second test', function() { hc.expect(hc.response.code).to.equal(200); });
    `);

    expect(result.logs).toEqual(['first', 'second']);
    expect(result.tests).toEqual([
      { name: 'first test', passed: true },
      { name: 'second test', passed: true }
    ]);
  });

  it('persists hc.data across multiple run() calls', () => {
    const context = createScriptContext({ variables: {} });

    context.run(`hc.data.mocks = { user: { id: 42 } };`);
    const result = context.run(`hc.data.mocks.user.id;`);

    expect(result.error).toBeUndefined();
    expect(result.value).toBe(42);
    expect(result.data).toEqual({ mocks: { user: { id: 42 } } });
  });
});
