import { describe, expect, it } from 'vitest';
import type { Completion, CompletionContext, CompletionSource } from '@codemirror/autocomplete';
import type { Variable } from '#/shared/types';
import { createHcCompletionSource } from '#/renderer/src/scripting/hcCompletions';

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

describe('createHcCompletionSource', () => {
  it('lists hc members for pre scripts without response', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.'));

    expect(result).not.toBeNull();
    expect(labels(result!.options).sort()).toEqual([
      'collection',
      'cookies',
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

    expect(labels(result!.options).sort()).toEqual(['get', 'toObject', 'upsert']);
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
      'url',
      'variables'
    ]);
  });

  it('lists request header helpers', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('hc.request.headers.'));

    expect(labels(result!.options).sort()).toEqual(['get', 'toObject', 'upsert']);
  });

  it('completes collection variables inside {{ }}', async () => {
    const source = createHcCompletionSource('pre', variables);
    const result = await complete(source, mockContext('const url = "{{ho'));

    expect(labels(result!.options)).toEqual(['host']);
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
});
