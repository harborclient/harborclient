import { describe, expect, it } from 'vitest';
import {
  createImportedSnippetDraft,
  snippetNameFromScript
} from '#/renderer/src/ui/Shared/Snippet/snippetEditDraft';

describe('snippetNameFromScript', () => {
  it('uses the trimmed first line as the name', () => {
    expect(snippetNameFromScript("// Set token\nhc.request.variables.set('token', 'abc');")).toBe(
      '// Set token'
    );
  });

  it('truncates the first line to 30 characters', () => {
    const longLine = 'a'.repeat(40);
    expect(snippetNameFromScript(`${longLine}\nconsole.log('ok');`)).toBe('a'.repeat(30));
  });

  it('falls back when the first line is empty or whitespace', () => {
    expect(snippetNameFromScript('\nhc.request.variables.set("token", "abc");')).toBe(
      'Untitled Snippet'
    );
    expect(snippetNameFromScript('   \nhc.request.variables.set("token", "abc");')).toBe(
      'Untitled Snippet'
    );
  });

  it('handles CRLF line endings', () => {
    expect(snippetNameFromScript('// CRLF line\r\nconsole.log(1);')).toBe('// CRLF line');
  });
});

describe('createImportedSnippetDraft', () => {
  it('returns a draft with derived name, imported code, and any scope', () => {
    const code = "// Auth helper\nhc.request.variables.set('token', 'abc');";
    expect(createImportedSnippetDraft(code)).toEqual({
      name: '// Auth helper',
      code,
      scope: 'any',
      stage: 'main'
    });
  });

  it('uses the provided scope when supplied', () => {
    const code = 'console.log("pre");';
    expect(createImportedSnippetDraft(code, 'pre-request')).toEqual({
      name: 'console.log("pre");',
      code,
      scope: 'pre-request',
      stage: 'main'
    });
  });
});
