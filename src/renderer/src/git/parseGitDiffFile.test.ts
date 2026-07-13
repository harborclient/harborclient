import { describe, expect, it } from 'vitest';
import type { GitRequestDiffFileEntry } from '#/shared/types';
import { inferGitDiffLanguage, parseGitDiffFileSides } from '#/renderer/src/git/parseGitDiffFile';

/**
 * Builds a minimal git diff file entry for parser tests.
 *
 * @param overrides - Partial fields to merge onto defaults.
 */
function createFileEntry(
  overrides: Partial<GitRequestDiffFileEntry> = {}
): GitRequestDiffFileEntry {
  return {
    path: '.harborclient/example.json',
    status: 'modified',
    binary: false,
    truncated: false,
    hasConflict: false,
    ...overrides
  };
}

describe('parseGitDiffFileSides', () => {
  it('parses added files into empty previous and full current text', () => {
    const sides = parseGitDiffFileSides(
      createFileEntry({
        status: 'added',
        diff: '--- /dev/null\n+++ .harborclient/new.json\n{"name":"new"}'
      })
    );

    expect(sides).toEqual({
      previous: '',
      current: '{"name":"new"}'
    });
  });

  it('parses deleted files into full previous and empty current text', () => {
    const sides = parseGitDiffFileSides(
      createFileEntry({
        status: 'deleted',
        diff: '--- .harborclient/old.json\n+++ /dev/null\n{"name":"old"}'
      })
    );

    expect(sides).toEqual({
      previous: '{"name":"old"}',
      current: ''
    });
  });

  it('parses modified files into separate previous and current bodies', () => {
    const sides = parseGitDiffFileSides(
      createFileEntry({
        status: 'modified',
        diff: [
          '--- .harborclient/request.json',
          '+++ .harborclient/request.json',
          '@@ working tree changes @@',
          '-{"name":"before"}',
          '+{"name":"after"}'
        ].join('\n')
      })
    );

    expect(sides).toEqual({
      previous: '{"name":"before"}',
      current: '{"name":"after"}'
    });
  });

  it('returns null for binary files', () => {
    expect(
      parseGitDiffFileSides(
        createFileEntry({
          binary: true,
          diff: undefined
        })
      )
    ).toBeNull();
  });

  it('returns null when diff text is missing or blank', () => {
    expect(parseGitDiffFileSides(createFileEntry({ diff: undefined }))).toBeNull();
    expect(parseGitDiffFileSides(createFileEntry({ diff: '   ' }))).toBeNull();
  });

  it('parses truncated modified diffs with the content that is present', () => {
    const sides = parseGitDiffFileSides(
      createFileEntry({
        status: 'modified',
        truncated: true,
        diff: [
          '--- .harborclient/request.json',
          '+++ .harborclient/request.json',
          '@@ working tree changes @@',
          '-line one',
          '+line two'
        ].join('\n')
      })
    );

    expect(sides).toEqual({
      previous: 'line one',
      current: 'line two'
    });
  });
});

describe('inferGitDiffLanguage', () => {
  it('maps common HarborClient file extensions to CodeEditor languages', () => {
    expect(inferGitDiffLanguage('.harborclient/requests/foo.json')).toBe('json');
    expect(inferGitDiffLanguage('.harborclient/docs/readme.md')).toBe('text');
    expect(inferGitDiffLanguage('.harborclient/scripts/pre.js')).toBe('javascript');
    expect(inferGitDiffLanguage('.harborclient/scripts/deploy.sh')).toBe('shell');
    expect(inferGitDiffLanguage('.harborclient/readme.txt')).toBe('text');
  });
});
