import { describe, expect, it } from 'vitest';
import type { ScriptRef, Snippet } from '#/shared/types';
import { createInlineScriptRef } from '#/shared/scriptRefs';
import { buildScriptModuleMap, buildSnippetModuleMap } from './scriptResolution';

function makeSnippet(overrides: Partial<Snippet> & Pick<Snippet, 'name' | 'code'>): Snippet {
  return {
    id: 1,
    uuid: 'uuid-1',
    scope: 'any',
    stage: 'main',
    source: 'local',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('buildSnippetModuleMap', () => {
  it('includes only import-valid snippet names', () => {
    const map = buildSnippetModuleMap([
      makeSnippet({ name: 'pass-testing.js', code: 'export const x = 1;' }),
      makeSnippet({ name: 'Pass Testing', code: 'hc.test("t", () => {});', id: 2, uuid: 'uuid-2' }),
      makeSnippet({
        name: 'utils/helpers.js',
        code: 'export function help() {}',
        id: 3,
        uuid: 'uuid-3'
      })
    ]);

    expect(map.modules).toEqual({
      'pass-testing.js': 'export const x = 1;',
      'utils/helpers.js': 'export function help() {}'
    });
    expect(map.conflicts).toEqual([]);
  });

  it('records duplicate import filenames as conflicts', () => {
    const map = buildSnippetModuleMap([
      makeSnippet({ name: 'dup.js', code: 'export const a = 1;', uuid: 'uuid-a' }),
      makeSnippet({ name: 'dup.js', code: 'export const b = 2;', id: 2, uuid: 'uuid-b' })
    ]);

    expect(map.modules['dup.js']).toBe('export const b = 2;');
    expect(map.conflicts).toEqual(['dup.js']);
  });
});

describe('buildScriptModuleMap', () => {
  it('includes importable inline scripts from request lists', () => {
    const beforeScript: ScriptRef = {
      ...createInlineScriptRef(
        "export const before = () => { console.log('BEFORE!'); };",
        'before.js',
        'before-all'
      ),
      enabled: true
    };
    const mainScript: ScriptRef = {
      ...createInlineScriptRef("import { before } from './before.js';", 'main-1.js', 'main'),
      enabled: true
    };

    const map = buildScriptModuleMap([], [[beforeScript, mainScript]]);

    expect(map.modules['before.js']).toContain('export const before');
    expect(map.modules['main-1.js']).toContain('import { before }');
    expect(map.conflicts).toEqual([]);
  });

  it('includes disabled inline scripts as importable modules', () => {
    const helperScript: ScriptRef = {
      ...createInlineScriptRef('export function helper() { return 1; }', 'helper.js', 'main'),
      enabled: false
    };

    const map = buildScriptModuleMap([], [[helperScript]]);

    expect(map.modules['helper.js']).toBe('export function helper() { return 1; }');
    expect(map.conflicts).toEqual([]);
  });

  it('ignores non-importable inline names and snippet-kind refs', () => {
    const inlineScript: ScriptRef = {
      ...createInlineScriptRef('export const x = 1;', 'Before All', 'before-all'),
      enabled: true
    };
    const snippetRef: ScriptRef = {
      id: 'snippet-ref',
      kind: 'snippet',
      snippetUuid: 'uuid-lib',
      enabled: true,
      stage: 'main'
    };

    const map = buildScriptModuleMap(
      [makeSnippet({ name: 'library.js', code: 'export const y = 2;' })],
      [[inlineScript, snippetRef]]
    );

    expect(map.modules).toEqual({
      'library.js': 'export const y = 2;'
    });
    expect(map.conflicts).toEqual([]);
  });

  it('flags duplicate names between library snippets and inline scripts', () => {
    const inlineScript: ScriptRef = {
      ...createInlineScriptRef('export const fromInline = 1;', 'shared.js', 'main'),
      enabled: true
    };

    const map = buildScriptModuleMap(
      [makeSnippet({ name: 'shared.js', code: 'export const fromLibrary = 2;' })],
      [[inlineScript]]
    );

    expect(map.modules['shared.js']).toBe('export const fromInline = 1;');
    expect(map.conflicts).toEqual(['shared.js']);
  });
});
