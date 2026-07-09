import { describe, expect, it } from 'vitest';
import { isImportableSnippetName, SNIPPET_IMPORT_NAME_PATTERN } from '#/shared/snippetImport';

describe('SNIPPET_IMPORT_NAME_PATTERN', () => {
  it('matches simple and nested .js filenames', () => {
    expect(SNIPPET_IMPORT_NAME_PATTERN.test('pass-testing.js')).toBe(true);
    expect(SNIPPET_IMPORT_NAME_PATTERN.test('utils/format-date.js')).toBe(true);
  });
});

describe('isImportableSnippetName', () => {
  it('accepts valid import filenames', () => {
    expect(isImportableSnippetName('pass-testing.js')).toBe(true);
    expect(isImportableSnippetName('utils/foo.js')).toBe(true);
    expect(isImportableSnippetName('  nested/path_v1.0.js  ')).toBe(true);
  });

  it('rejects names without a .js extension', () => {
    expect(isImportableSnippetName('Pass Testing')).toBe(false);
    expect(isImportableSnippetName('pass-testing')).toBe(false);
    expect(isImportableSnippetName('utils/foo.ts')).toBe(false);
  });

  it('rejects leading slashes and path traversal segments', () => {
    expect(isImportableSnippetName('/pass-testing.js')).toBe(false);
    expect(isImportableSnippetName('utils/../foo.js')).toBe(false);
    expect(isImportableSnippetName('./pass-testing.js')).toBe(false);
  });

  it('rejects empty and whitespace-only names', () => {
    expect(isImportableSnippetName('')).toBe(false);
    expect(isImportableSnippetName('   ')).toBe(false);
  });
});
