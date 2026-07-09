import { describe, expect, it } from 'vitest';
import type { Snippet } from '#/shared/types';
import { buildSnippetModuleMap } from '#/renderer/src/scripting/scriptResolution';

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
