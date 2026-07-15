import { describe, expect, it } from 'vitest';
import type { Completion, CompletionContext, CompletionSource } from '@codemirror/autocomplete';
import type { Variable } from '#/shared/types';
import { createHcCompletionSource, createLiveHcCompletionSource } from './hcCompletions';

/**
 * Builds a minimal CompletionContext for testing matchBefore-based sources.
 *
 * @param before - Text before the cursor.
 */
function mockContext(before: string): CompletionContext {
  const pos = before.length;
  return {
    pos,
    explicit: false,
    state: {
      doc: {
        sliceString: (from: number, to: number) => before.slice(from, to),
        lineAt: (linePos: number) => {
          const lastNewline = before.lastIndexOf('\n', linePos - 1);
          const from = lastNewline === -1 ? 0 : lastNewline + 1;
          const nextNewline = before.indexOf('\n', from);
          const to = nextNewline === -1 ? before.length : nextNewline;
          return { from, to, text: before.slice(from, to) };
        }
      }
    },
    matchBefore: (regex: RegExp) => {
      const match = before.match(new RegExp(`${regex.source}$`));
      if (!match) return null;
      const text = match[0];
      return { from: pos - text.length, to: pos, text };
    }
  } as CompletionContext;
}

/**
 * Runs a synchronous completion source and returns its result.
 *
 * @param source - HarborClient completion source under test.
 * @param context - Mock completion context.
 */
async function complete(
  source: CompletionSource,
  context: CompletionContext
): Promise<{ from: number; options: readonly Completion[] } | null> {
  const result = await source(context);
  if (!result) return null;
  return { from: result.from, options: result.options };
}

function labels(options: readonly Completion[]): string[] {
  return options.map((option) => option.label);
}

const variables: Variable[] = [
  { key: 'host', value: 'api.example.com', defaultValue: '', share: false },
  { key: 'token', value: 'abc', defaultValue: 'fallback', share: false }
];

const importableSnippetNames = ['pass-testing.js', 'utils/foo.js', 'utils/bar.js'];

describe('createHcCompletionSource import paths', () => {
  it('suggests top-level files and folders after ./', async () => {
    const source = createHcCompletionSource('pre', variables, importableSnippetNames);
    const result = await complete(source, mockContext("import { passTest } from './"));

    expect(result).not.toBeNull();
    expect(labels(result!.options).sort()).toEqual(['pass-testing.js', 'utils/']);
  });

  it('suggests files inside a folder prefix', async () => {
    const source = createHcCompletionSource('pre', variables, importableSnippetNames);
    const result = await complete(source, mockContext("import { passTest } from './utils/"));

    expect(result).not.toBeNull();
    expect(labels(result!.options).sort()).toEqual(['bar.js', 'foo.js']);
  });

  it('filters file suggestions by partial segment', async () => {
    const source = createHcCompletionSource('pre', variables, importableSnippetNames);
    const result = await complete(source, mockContext("import { passTest } from './utils/f"));

    expect(result).not.toBeNull();
    expect(labels(result!.options)).toEqual(['foo.js']);
  });

  it('supports bare import statements', async () => {
    const source = createHcCompletionSource('pre', variables, importableSnippetNames);
    const result = await complete(source, mockContext("import './"));

    expect(result).not.toBeNull();
    expect(labels(result!.options).sort()).toEqual(['pass-testing.js', 'utils/']);
  });

  it('supports dynamic import statements', async () => {
    const source = createHcCompletionSource('pre', variables, importableSnippetNames);
    const result = await complete(source, mockContext("import('./utils/"));

    expect(result).not.toBeNull();
    expect(labels(result!.options).sort()).toEqual(['bar.js', 'foo.js']);
  });

  it('does not suggest snippet paths for bare package imports', async () => {
    const source = createHcCompletionSource('pre', variables, importableSnippetNames);
    const result = await complete(source, mockContext("import dayjs from 'lodash"));

    expect(result).toBeNull();
  });

  it('falls back to hc completions when snippet names are omitted', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.request.'));

    expect(result).not.toBeNull();
    expect(labels(result!.options)).toContain('url');
  });
});

describe('createHcCompletionSource', () => {
  it('lists hc members for pre scripts without response', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.'));

    expect(result).not.toBeNull();
    expect(labels(result!.options).sort()).toEqual([
      'collection',
      'cookies',
      'data',
      'environment',
      'execution',
      'expect',
      'globals',
      'info',
      'request',
      'sendRequest',
      'test'
    ]);
  });

  it('includes response for post scripts', async () => {
    const source = createHcCompletionSource('post', variables);
    const result = await complete(source, mockContext('hc.'));

    expect(labels(result!.options).sort()).toEqual([
      'collection',
      'cookies',
      'data',
      'environment',
      'execution',
      'expect',
      'globals',
      'info',
      'request',
      'response',
      'sendRequest',
      'test'
    ]);
  });

  it('lists collection variable helpers', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.collection.variables.'));

    expect(labels(result!.options).sort()).toEqual(['clear', 'get', 'set']);
  });

  it('lists request variable helpers including replaceIn', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.request.variables.'));

    expect(labels(result!.options).sort()).toEqual(['clear', 'get', 'replaceIn', 'set']);
  });

  it('lists cookie helpers', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.cookies.'));

    expect(labels(result!.options).sort()).toEqual(['clear', 'get', 'set']);
  });

  it('lists execution helpers', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.execution.'));

    expect(labels(result!.options).sort()).toEqual(['setNextRequest', 'skipRequest']);
  });

  it('lists collection members', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.collection.'));

    expect(labels(result!.options).sort()).toEqual(['auth', 'headers', 'id', 'name', 'variables']);
  });

  it('lists collection header helpers', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.collection.headers.'));

    expect(labels(result!.options).sort()).toEqual(['clear', 'get', 'set']);
  });

  it('lists environment members', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.environment.'));

    expect(labels(result!.options).sort()).toEqual(['name', 'variables']);
  });

  it('lists environment variable helpers', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.environment.variables.'));

    expect(labels(result!.options).sort()).toEqual(['clear', 'get', 'set']);
  });

  it('lists global variable helpers', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.globals.'));

    expect(labels(result!.options).sort()).toEqual(['clear', 'get', 'set']);
  });

  it('lists request members', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.request.'));

    expect(labels(result!.options).sort()).toEqual([
      'auth',
      'body',
      'headers',
      'method',
      'notes',
      'params',
      'url',
      'variables'
    ]);
  });

  it('lists request header helpers', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.request.headers.'));

    expect(labels(result!.options).sort()).toEqual(['clear', 'get', 'set']);
  });

  it('lists request params helpers', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.request.params.'));

    expect(labels(result!.options).sort()).toEqual(['clear', 'get', 'set']);
  });

  it('lists request notes helpers', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.request.notes.'));

    expect(labels(result!.options).sort()).toEqual(['clear', 'get', 'set']);
  });

  it('completes collection variables inside {{ }}', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('const url = "{{ho'));

    expect(labels(result!.options)).toEqual(['host']);
  });

  it('completes filter names after | inside {{ }}', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('const url = "{{host|u'));

    expect(labels(result!.options)).toEqual(['upper', 'urlencode']);
  });

  it('reads the latest variables from a getter on each completion query', async () => {
    let currentVariables: Variable[] = [
      { key: 'host', value: 'api.example.com', defaultValue: '', share: false }
    ];
    const source = createHcCompletionSource('pre', () => currentVariables);

    const firstResult = await complete(source, mockContext('const url = "{{ho'));
    expect(labels(firstResult!.options)).toEqual(['host']);

    currentVariables = [{ key: 'token', value: 'abc', defaultValue: 'fallback', share: false }];

    const secondResult = await complete(source, mockContext('const url = "{{to'));
    expect(labels(secondResult!.options)).toEqual(['token']);
  });

  it('reads the latest phase and variables from live getters', async () => {
    let currentPhase: 'pre' | 'post' = 'pre';
    let currentVariables: Variable[] = [
      { key: 'host', value: 'api.example.com', defaultValue: '', share: false }
    ];
    const source = createLiveHcCompletionSource(
      () => currentPhase,
      () => currentVariables
    );

    const preResult = await complete(source, mockContext('hc.'));
    expect(labels(preResult!.options).sort()).not.toContain('response');

    currentPhase = 'post';

    const postResult = await complete(source, mockContext('hc.'));
    expect(labels(postResult!.options).sort()).toContain('response');

    currentVariables = [{ key: 'token', value: 'abc', defaultValue: 'fallback', share: false }];

    const variableResult = await complete(source, mockContext('const url = "{{to'));
    expect(labels(variableResult!.options)).toEqual(['token']);
  });

  it('returns null when nothing matches', async () => {
    const source = createHcCompletionSource('pre', variables);
    expect(await complete(source, mockContext('const x = 1;'))).toBeNull();
  });

  it('filters hc options by partial input', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.re'));

    expect(labels(result!.options)).toEqual(['request']);
  });

  it('completes hc.expect(...).to. with common Chai matchers in post scripts', async () => {
    const source = createHcCompletionSource('post', variables);
    const result = await complete(source, mockContext('hc.expect(hc.response.code).to.'));

    expect(result).not.toBeNull();
    expect(labels(result!.options)).toEqual(
      expect.arrayContaining(['equal', 'eql', 'be', 'have', 'not'])
    );
  });

  it('completes hc.expect(...).to. with common Chai matchers in pre scripts', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.expect(true).to.'));

    expect(result).not.toBeNull();
    expect(labels(result!.options)).toEqual(
      expect.arrayContaining(['equal', 'eql', 'be', 'have', 'not'])
    );
  });

  it('filters hc.expect(...).to.eq to equal and eql', async () => {
    const source = createHcCompletionSource('post', variables);
    const result = await complete(source, mockContext('hc.expect(hc.response.code).to.eq'));

    expect(labels(result!.options).sort()).toEqual(['eql', 'equal']);
  });

  it('completes hc.expect with nested call arguments', async () => {
    const source = createHcCompletionSource('post', variables);
    const result = await complete(source, mockContext('hc.expect(hc.response.json()).to.'));

    expect(result).not.toBeNull();
    expect(labels(result!.options)).toEqual(expect.arrayContaining(['equal', 'eql']));
  });

  it('completes hc.response.to. with chain starters in post scripts', async () => {
    const source = createHcCompletionSource('post', variables);
    const result = await complete(source, mockContext('hc.response.to.'));

    expect(result).not.toBeNull();
    expect(labels(result!.options)).toEqual(
      expect.arrayContaining(['have', 'be', 'not', 'status'])
    );
    expect(labels(result!.options)).not.toEqual(expect.arrayContaining(['notFound']));
  });

  it('completes indented hc.response.to. inside real script lines', async () => {
    const source = createHcCompletionSource('post', variables);
    const result = await complete(source, mockContext('  hc.response.to.'));

    expect(result).not.toBeNull();
    expect(labels(result!.options)).toEqual(expect.arrayContaining(['have', 'status']));
  });

  it('completes hc.response.to. inside hc.test callbacks', async () => {
    const source = createHcCompletionSource('post', variables);
    const result = await complete(source, mockContext('hc.test("x", function() { hc.response.to.'));

    expect(result).not.toBeNull();
    expect(labels(result!.options)).toEqual(expect.arrayContaining(['have', 'be']));
  });

  it('completes hc.response.to.have. inside hc.test callbacks', async () => {
    const source = createHcCompletionSource('post', variables);
    const result = await complete(
      source,
      mockContext('hc.test("x", function() { hc.response.to.have.')
    );

    expect(labels(result!.options)).toEqual(expect.arrayContaining(['status', 'header']));
  });

  it('completes hc.expect(hc.response.status).to. unchanged after response chain fix', async () => {
    const source = createHcCompletionSource('post', variables);
    const result = await complete(source, mockContext('hc.expect(hc.response.status).to.'));

    expect(result).not.toBeNull();
    expect(labels(result!.options)).toEqual(
      expect.arrayContaining(['equal', 'eql', 'be', 'have', 'not'])
    );
  });

  it('returns null for hc.response.to. in pre scripts', async () => {
    const source = createHcCompletionSource('pre', variables);
    expect(await complete(source, mockContext('hc.response.to.'))).toBeNull();
  });

  it('completes hc.response.to.have. with response have matchers', async () => {
    const source = createHcCompletionSource('post', variables);
    const result = await complete(source, mockContext('hc.response.to.have.'));

    expect(labels(result!.options)).toEqual(
      expect.arrayContaining(['status', 'header', 'jsonBody', 'notFound'])
    );
  });

  it('bounds chai chain lookback to the current line for long scripts', async () => {
    const source = createHcCompletionSource('post', variables);
    const longPrefix = `// ${'x'.repeat(5000)}\n`.repeat(3);
    const result = await complete(source, mockContext(`${longPrefix}hc.expect(true).to.`));

    expect(result).not.toBeNull();
    expect(labels(result!.options)).toEqual(expect.arrayContaining(['equal', 'eql']));
  });

  it('skips dotted-path fallback when receiver is an hc.response.to chain', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.response.to.'));

    expect(result).toBeNull();
  });

  it('skips dotted-path fallback when receiver is an hc.expect chain with no matches', async () => {
    const source = createHcCompletionSource('post', variables);
    const result = await complete(source, mockContext('hc.expect(hc.response.code).to.zzz'));

    expect(result).toBeNull();
  });

  it('still completes unrelated dotted paths on lines that also contain hc.expect', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.expect(x).to.equal(1); hc.request.'));

    expect(result).not.toBeNull();
    expect(labels(result!.options).sort()).toEqual([
      'auth',
      'body',
      'headers',
      'method',
      'notes',
      'params',
      'url',
      'variables'
    ]);
  });

  it('still completes unrelated dotted paths when expect is absent', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.request.'));

    expect(result).not.toBeNull();
    expect(labels(result!.options).sort()).toEqual([
      'auth',
      'body',
      'headers',
      'method',
      'notes',
      'params',
      'url',
      'variables'
    ]);
  });
});
