import { describe, expect, it } from 'vitest';
import { createInlineScriptRef, createSnippetScriptRef } from './scriptRefs';
import { buildSnippetBundle, parseSnippetBundle } from './snippetBundle';
import type { Snippet } from '#/shared/types/snippet';

const librarySnippet: Snippet = {
  id: 1,
  uuid: 'snippet-uuid-1',
  name: 'Library snippet',
  code: 'hc.set("token", "abc");',
  scope: 'any',
  stage: 'before-each',
  source: 'local',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z'
};

describe('buildSnippetBundle', () => {
  it('serializes inline and snippet-referenced rows with resolved code', () => {
    const scripts = [
      createInlineScriptRef('console.log("inline");', 'Inline script', 'main'),
      createSnippetScriptRef('snippet-uuid-1', 'Linked snippet', 'before-each')
    ];

    const bundle = buildSnippetBundle(scripts, [librarySnippet], 'pre');

    expect(bundle).toEqual({
      harborclientVersion: 1,
      harborclientExport: 'snippets-bundle',
      snippets: [
        {
          name: 'Inline script',
          code: 'console.log("inline");',
          scope: 'pre-request',
          stage: 'main'
        },
        {
          name: 'Linked snippet',
          code: 'hc.set("token", "abc");',
          scope: 'any',
          stage: 'before-each',
          uuid: 'snippet-uuid-1'
        }
      ]
    });
  });

  it('derives names from code when script rows are unnamed', () => {
    const scripts = [createInlineScriptRef('// auto name line', undefined, 'main')];

    const bundle = buildSnippetBundle(scripts, [], 'post');

    expect(bundle.snippets[0]?.name).toBe('// auto name line');
    expect(bundle.snippets[0]?.scope).toBe('post-request');
  });
});

describe('parseSnippetBundle', () => {
  it('round-trips a bundle built from script rows', () => {
    const scripts = [createInlineScriptRef('hc.log("ok");', 'Ok script', 'after-each')];
    const bundle = buildSnippetBundle(scripts, [], 'pre');
    const raw = JSON.stringify(bundle, null, 2);

    expect(parseSnippetBundle(raw)).toEqual(bundle);
  });

  it('rejects invalid bundle discriminators', () => {
    const raw = JSON.stringify({
      harborclientVersion: 1,
      harborclientExport: 'snippet',
      snippets: []
    });

    expect(() => parseSnippetBundle(raw)).toThrow(
      'Invalid snippets bundle: harborclientExport must be "snippets-bundle".'
    );
  });

  it('rejects malformed snippet entries', () => {
    const raw = JSON.stringify({
      harborclientVersion: 1,
      harborclientExport: 'snippets-bundle',
      snippets: [{ name: 'Missing code', scope: 'any', stage: 'main' }]
    });

    expect(() => parseSnippetBundle(raw)).toThrow(
      'Invalid snippets bundle: entry at index 0 is malformed.'
    );
  });
});
