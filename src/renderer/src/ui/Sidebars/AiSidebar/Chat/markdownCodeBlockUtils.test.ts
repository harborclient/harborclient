import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import {
  extractCodeBlockContent,
  extractCodeBlockFromPreNode,
  flattenReactNodeToString,
  mapFenceLanguageToCodeEditorLanguage,
  type PreElementNode
} from './markdownCodeBlockUtils';

const bashPreNode: PreElementNode = {
  type: 'element',
  tagName: 'pre',
  children: [
    {
      type: 'element',
      tagName: 'code',
      properties: {
        className: ['language-bash']
      },
      children: [
        {
          type: 'text',
          value: 'harborclient --path-theme dark\n'
        }
      ]
    }
  ]
};

describe('extractCodeBlockFromPreNode', () => {
  it('extracts text and language from a pre hast node', () => {
    expect(extractCodeBlockFromPreNode(bashPreNode)).toEqual({
      text: 'harborclient --path-theme dark\n',
      language: 'bash'
    });
  });

  it('returns empty text when the pre node has no code child', () => {
    expect(extractCodeBlockFromPreNode({ type: 'element', tagName: 'pre', children: [] })).toEqual({
      text: '',
      language: undefined
    });
  });
});

describe('flattenReactNodeToString', () => {
  it('joins array children into one string', () => {
    expect(flattenReactNodeToString(['line1\n', 'line2'])).toBe('line1\nline2');
  });
});

describe('extractCodeBlockContent', () => {
  it('prefers the pre hast node when present', () => {
    const child = createElement('code', { className: 'language-typescript' }, 'ignored\n');

    expect(extractCodeBlockContent(child, bashPreNode)).toEqual({
      text: 'harborclient --path-theme dark\n',
      language: 'bash'
    });
  });

  it('extracts text and language from a fenced code element', () => {
    const child = createElement('code', { className: 'language-typescript' }, 'const x = 1;\n');

    expect(extractCodeBlockContent(child)).toEqual({
      text: 'const x = 1;\n',
      language: 'typescript'
    });
  });

  it('flattens array children from a rendered code element', () => {
    const child = createElement('code', { className: 'language-bash' }, ['line1\n', 'line2']);

    expect(extractCodeBlockContent(child)).toEqual({
      text: 'line1\nline2',
      language: 'bash'
    });
  });

  it('extracts text from fenced blocks without a language tag', () => {
    const child = createElement('code', undefined, 'plain block\n');

    expect(extractCodeBlockContent(child)).toEqual({
      text: 'plain block\n',
      language: undefined
    });
  });

  it('returns empty text when children are not a code element', () => {
    expect(extractCodeBlockContent('plain text')).toEqual({
      text: '',
      language: undefined
    });
  });
});

describe('mapFenceLanguageToCodeEditorLanguage', () => {
  it('maps known fence languages to CodeEditor modes', () => {
    expect(mapFenceLanguageToCodeEditorLanguage('json')).toBe('json');
    expect(mapFenceLanguageToCodeEditorLanguage('typescript')).toBe('javascript');
    expect(mapFenceLanguageToCodeEditorLanguage('bash')).toBe('shell');
  });

  it('falls back to text for unknown languages', () => {
    expect(mapFenceLanguageToCodeEditorLanguage('python')).toBe('text');
    expect(mapFenceLanguageToCodeEditorLanguage()).toBe('text');
  });
});
