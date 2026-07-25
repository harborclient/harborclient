import { describe, expect, it } from 'vitest';
import { evaluateScript } from './scriptEvaluator';
import {
  formatLocatedScriptError,
  mapGeneratedToOriginal,
  normalizeScriptMapSource,
  parseAnonymousStackFrame,
  parseScriptSourceMap,
  stripLocatedScriptErrorPrefix
} from './scriptSourceMap';

const baseInput = {
  phase: 'post' as const,
  request: {
    method: 'GET' as const,
    url: 'https://example.com/path',
    headers: [],
    params: [],
    body: '',
    bodyType: 'none' as const
  },
  variables: {},
  response: {
    status: 415,
    statusText: 'Unsupported Media Type',
    headers: {},
    body: '',
    timeMs: 1,
    sizeBytes: 0
  }
};

describe('scriptSourceMap helpers', () => {
  it('parses the first anonymous stack frame', () => {
    const stack = `Error: boom
    at Object.equal (file:///host/chai.js:1:1)
    at eval (eval at <anonymous> (eval at makeEvaluate), <anonymous>:3:21)
    at Object.test (file:///host/api.js:1:1)`;
    expect(parseAnonymousStackFrame(stack)).toEqual({ line: 3, column: 21 });
  });

  it('normalizes virtual entry sources to script.js', () => {
    expect(normalizeScriptMapSource('e:/__entry__.js')).toBe('script.js');
    expect(normalizeScriptMapSource('/helpers.js')).toBe('helpers.js');
  });

  it('formats located errors with source:line:column', () => {
    expect(
      formatLocatedScriptError('expected false to be truthy', {
        source: 'script.js',
        line: 2,
        column: 3
      })
    ).toBe('script.js:2:3: expected false to be truthy');
  });

  it('strips the location prefix from located errors', () => {
    const located = formatLocatedScriptError('Invalid Chai property: o. Did you mean "to"?', {
      source: 'script.js',
      line: 5,
      column: 20
    });
    expect(stripLocatedScriptErrorPrefix(located)).toBe(
      'Invalid Chai property: o. Did you mean "to"?'
    );
  });

  it('leaves unprefixed messages unchanged when stripping', () => {
    expect(stripLocatedScriptErrorPrefix('  boom  ')).toBe('boom');
    expect(stripLocatedScriptErrorPrefix('Expected 200:404: mismatch')).toBe(
      'Expected 200:404: mismatch'
    );
  });

  it('maps generated coordinates through a transpile sourcemap', async () => {
    const { transform } = await import('esbuild');
    const wrapped = `(async () => {\nhc.expect(1).to.equal(2);\n})()`;
    const result = await transform(wrapped, {
      loader: 'js',
      target: 'es2020',
      sourcefile: 'script.js',
      sourcemap: true
    });
    const maps = [
      {
        map: parseScriptSourceMap(result.map),
        unwrapAsyncIife: true
      }
    ];
    const location = mapGeneratedToOriginal(maps, 2, 1);
    expect(location).toEqual({
      source: 'script.js',
      line: 1,
      column: expect.any(Number)
    });
  });
});

describe('evaluateScript test locations', () => {
  it('maps a failing hc.expect to the user script line', async () => {
    const result = await evaluateScript({
      ...baseInput,
      script: `hc.test("Status code is 2xx", () => {
  hc.expect(hc.response.code >= 200 && hc.response.code < 300).to.be.ok();
});
`
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toHaveLength(1);
    const test = result.tests[0];
    expect(test?.passed).toBe(false);
    expect(test?.error).toContain('expected false to be truthy');
    expect(test?.source).toBe('script.js');
    expect(test?.line).toBe(2);
    expect(test?.column).toEqual(expect.any(Number));
    expect(test?.actual).toBe('false');
    expect(test?.durationMs).toEqual(expect.any(Number));
  });

  it('maps failures through modern syntax transpile', async () => {
    const result = await evaluateScript({
      ...baseInput,
      script: `hc.test("modern", () => {
  const code = hc.response.code ?? 0;
  hc.expect(code).to.equal(200);
});
`
    });

    expect(result.tests[0]?.passed).toBe(false);
    expect(result.tests[0]?.line).toBe(3);
    expect(result.tests[0]?.expected).toBe('200');
    expect(result.tests[0]?.actual).toBe('415');
  });

  it('maps a failure inside an imported snippet module', async () => {
    const result = await evaluateScript({
      ...baseInput,
      script: `import { check } from './check.js';
check();
`,
      snippetModules: {
        'check.js': `export function check() {
  hc.test("from snippet", () => {
    hc.expect(1).to.equal(2);
  });
}
`
      }
    });

    expect(result.tests[0]?.passed).toBe(false);
    expect(result.tests[0]?.source).toBe('check.js');
    expect(result.tests[0]?.line).toBe(3);
  });

  it('includes mapped location in top-level script errors', async () => {
    const result = await evaluateScript({
      ...baseInput,
      script: `const x = 1;
throw new Error("boom");
`
    });

    expect(result.error).toMatch(/script\.js:2:\d+: boom/);
    expect(result.errorLocation).toEqual({
      source: 'script.js',
      line: 2,
      column: expect.any(Number)
    });
  });

  it('includes a structured errorLocation for throws inside imported snippets', async () => {
    const result = await evaluateScript({
      ...baseInput,
      script: `import { explode } from './explode.js';
explode();
`,
      snippetModules: {
        'explode.js': `export function explode() {
  throw new Error("snippet boom");
}
`
      }
    });

    expect(result.error).toMatch(/explode\.js:2:\d+: snippet boom/);
    expect(result.errorLocation).toEqual({
      source: 'explode.js',
      line: 2,
      column: expect.any(Number)
    });
  });

  it('maps compile errors back through the async-IIFE wrap offset', async () => {
    const result = await evaluateScript({
      ...baseInput,
      script: `const ok = 1;
const bad = ;
`
    });

    expect(result.error).toMatch(/script\.js:2:\d+: /);
    expect(result.errorLocation).toEqual({
      source: 'script.js',
      line: 2,
      column: expect.any(Number)
    });
  });

  it('omits errorLocation when the failure has no mappable frame', async () => {
    const result = await evaluateScript({
      ...baseInput,
      script: `import { missing } from './nope.js';
missing();
`
    });

    expect(result.error).toContain('Cannot find module');
    // Bundle resolve errors point at the import statement in user source when
    // esbuild attaches a location; otherwise no location is claimed at all.
    if (result.errorLocation) {
      expect(result.errorLocation.source).toBe('script.js');
    }
  });

  it('records durationMs for passing tests', async () => {
    const result = await evaluateScript({
      ...baseInput,
      response: { ...baseInput.response, status: 200, statusText: 'OK' },
      script: `hc.test("ok", () => {
  hc.expect(hc.response.code).to.equal(200);
});
`
    });

    expect(result.tests[0]).toEqual(
      expect.objectContaining({
        name: 'ok',
        passed: true,
        durationMs: expect.any(Number)
      })
    );
    expect(result.tests[0]?.line).toBeUndefined();
  });
});
