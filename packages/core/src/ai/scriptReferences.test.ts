import { describe, expect, it } from 'vitest';
import {
  buildAiScriptSelectionContextMessage,
  buildWebpageReferenceToken,
  collectChatReferenceSnapshots,
  findAiScriptReferenceCandidates,
  isValidAiScriptReference,
  resolveAiScriptReferenceLabel,
  resolveAiScriptReferenceName,
  stripAiScriptReferences,
  tokenizeChatComposerText,
  type AiScriptReferenceValidationContext
} from './scriptReferences';
import type { ScriptRef, Snippet } from '../types';

/**
 * Builds a validation context with sensible defaults for tests.
 *
 * @param overrides - Partial context fields to override.
 */
function context(
  overrides: Partial<AiScriptReferenceValidationContext> = {}
): AiScriptReferenceValidationContext {
  return {
    hasActiveRequestTab: true,
    activeRequestId: 42,
    preScriptCount: 2,
    postScriptCount: 1,
    ...overrides
  };
}

/**
 * Builds a minimal inline script row for name-resolution tests.
 *
 * @param overrides - Partial script fields to override.
 */
function inlineScript(overrides: Partial<ScriptRef> = {}): ScriptRef {
  return {
    id: 'script-1',
    enabled: true,
    kind: 'inline',
    ...overrides
  };
}

/**
 * Builds a minimal snippet row for name-resolution tests.
 *
 * @param overrides - Partial snippet fields to override.
 */
function snippet(overrides: Partial<Snippet> = {}): Snippet {
  return {
    id: 1,
    uuid: 'snippet-uuid',
    name: 'Auth helper',
    code: 'console.log("auth");',
    scope: 'any',
    stage: 'main',
    source: 'local',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('findAiScriptReferenceCandidates', () => {
  it('finds active and numeric script references', () => {
    expect(findAiScriptReferenceCandidates('@active.pre.1')).toEqual([
      expect.objectContaining({
        requestId: 'active',
        phase: 'pre',
        scriptIndex: 1,
        text: '@active.pre.1'
      })
    ]);

    expect(findAiScriptReferenceCandidates('Use @42.post.2 please')).toEqual([
      expect.objectContaining({
        requestId: 42,
        phase: 'post',
        scriptIndex: 2,
        start: 4,
        text: '@42.post.2'
      })
    ]);
  });

  it('rejects malformed references', () => {
    expect(findAiScriptReferenceCandidates('@42.pre')).toEqual([]);
    expect(findAiScriptReferenceCandidates('@42.Pre.1')).toEqual([]);
  });

  it('stops script index at the first non-digit character', () => {
    expect(findAiScriptReferenceCandidates('@active.pre.12extra')).toEqual([
      expect.objectContaining({
        requestId: 'active',
        phase: 'pre',
        scriptIndex: 12,
        text: '@active.pre.12'
      })
    ]);
  });

  it('requires a boundary before @', () => {
    expect(findAiScriptReferenceCandidates('foo@active.pre.1')).toEqual([]);
    expect(findAiScriptReferenceCandidates('@@active.pre.1')).toEqual([]);
  });

  it('finds multiple references in one draft', () => {
    const matches = findAiScriptReferenceCandidates('@active.pre.1\n\n@42.post.1');
    expect(matches).toHaveLength(2);
    expect(matches[0]?.text).toBe('@active.pre.1');
    expect(matches[1]?.text).toBe('@42.post.1');
  });

  it('parses optional selection suffixes', () => {
    expect(findAiScriptReferenceCandidates('@active.pre.1#10.42')).toEqual([
      expect.objectContaining({
        requestId: 'active',
        phase: 'pre',
        scriptIndex: 1,
        text: '@active.pre.1#10.42',
        selection: { start: 10, end: 42 }
      })
    ]);
  });

  it('rejects malformed selection suffixes', () => {
    expect(findAiScriptReferenceCandidates('@active.pre.1#10')).toEqual([
      expect.objectContaining({
        text: '@active.pre.1'
      })
    ]);
    expect(findAiScriptReferenceCandidates('@active.pre.1#10.')).toEqual([
      expect.objectContaining({
        text: '@active.pre.1'
      })
    ]);
    expect(findAiScriptReferenceCandidates('@active.pre.1#10.5extra')).toEqual([
      expect.objectContaining({
        text: '@active.pre.1#10.5',
        selection: undefined
      })
    ]);
  });

  it('finds standalone snippet references by uuid', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(findAiScriptReferenceCandidates(`@snippet.${uuid}`)).toEqual([
      expect.objectContaining({
        kind: 'snippet',
        snippetUuid: uuid,
        text: `@snippet.${uuid}`
      })
    ]);
  });

  it('parses snippet references with selection suffixes', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(findAiScriptReferenceCandidates(`@snippet.${uuid}#10.42`)).toEqual([
      expect.objectContaining({
        kind: 'snippet',
        snippetUuid: uuid,
        text: `@snippet.${uuid}#10.42`,
        selection: { start: 10, end: 42 }
      })
    ]);
  });

  it('finds mixed request-script and snippet references', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const matches = findAiScriptReferenceCandidates(`@active.pre.1 and @snippet.${uuid}`);
    expect(matches).toHaveLength(2);
    expect(matches[0]).toEqual(
      expect.objectContaining({ kind: 'request-script', text: '@active.pre.1' })
    );
    expect(matches[1]).toEqual(expect.objectContaining({ kind: 'snippet', snippetUuid: uuid }));
  });

  it('rejects malformed snippet references', () => {
    expect(findAiScriptReferenceCandidates('@snippet.not-a-uuid')).toEqual([]);
    expect(findAiScriptReferenceCandidates('@snippet.550e8400')).toEqual([]);
  });

  it('finds terminal references with line-range suffixes', () => {
    expect(findAiScriptReferenceCandidates('@term.2#1.33')).toEqual([
      expect.objectContaining({
        kind: 'terminal',
        terminalIndex: 2,
        text: '@term.2#1.33',
        selection: { start: 1, end: 33 }
      })
    ]);
  });

  it('rejects malformed terminal references', () => {
    expect(findAiScriptReferenceCandidates('@term.0#1.2')).toEqual([]);
    expect(findAiScriptReferenceCandidates('@term.2')).toEqual([
      expect.objectContaining({
        kind: 'terminal',
        terminalIndex: 2,
        selection: undefined
      })
    ]);
    expect(findAiScriptReferenceCandidates('@term.2#1.0')).toEqual([
      expect.objectContaining({
        kind: 'terminal',
        terminalIndex: 2,
        selection: undefined
      })
    ]);
  });

  it('finds markdown references with character-offset suffixes', () => {
    const markdownUuid = '44444444-4444-4444-4444-444444444444';
    expect(findAiScriptReferenceCandidates(`@markdown.${markdownUuid}#10.42`)).toEqual([
      expect.objectContaining({
        kind: 'markdown',
        markdownUuid,
        text: `@markdown.${markdownUuid}#10.42`,
        selection: { start: 10, end: 42 }
      })
    ]);
  });

  it('rejects malformed markdown references', () => {
    expect(findAiScriptReferenceCandidates('@markdown.not-a-uuid#1.2')).toEqual([]);
    expect(findAiScriptReferenceCandidates('@markdown.550e8400#1.2')).toEqual([]);
    expect(
      findAiScriptReferenceCandidates('@markdown.550e8400-e29b-41d4-a716-446655440000')
    ).toEqual([
      expect.objectContaining({
        kind: 'markdown',
        selection: undefined
      })
    ]);
  });

  it('finds raw body references with character-offset suffixes', () => {
    expect(findAiScriptReferenceCandidates('@body#10.42')).toEqual([
      expect.objectContaining({
        kind: 'body',
        text: '@body#10.42',
        selection: { start: 10, end: 42 }
      })
    ]);
  });

  it('parses bare @body without a selection suffix', () => {
    expect(findAiScriptReferenceCandidates('@body')).toEqual([
      expect.objectContaining({
        kind: 'body',
        text: '@body',
        selection: undefined
      })
    ]);
  });

  it('finds collection, folder, and request references by uuid', () => {
    const collectionUuid = '11111111-1111-1111-1111-111111111111';
    const folderUuid = '22222222-2222-2222-2222-222222222222';
    const requestUuid = '33333333-3333-3333-3333-333333333333';

    expect(findAiScriptReferenceCandidates(`@collection.${collectionUuid}`)).toEqual([
      expect.objectContaining({
        kind: 'collection',
        collectionUuid,
        text: `@collection.${collectionUuid}`
      })
    ]);
    expect(findAiScriptReferenceCandidates(`@folder.${folderUuid}`)).toEqual([
      expect.objectContaining({
        kind: 'folder',
        folderUuid,
        text: `@folder.${folderUuid}`
      })
    ]);
    expect(findAiScriptReferenceCandidates(`@request.${requestUuid}`)).toEqual([
      expect.objectContaining({
        kind: 'request',
        requestUuid,
        text: `@request.${requestUuid}`
      })
    ]);
  });

  it('finds webpage references by browser tab uuid', () => {
    const tabId = '44444444-4444-4444-4444-444444444444';

    expect(findAiScriptReferenceCandidates(`@webpage.${tabId}`)).toEqual([
      expect.objectContaining({
        kind: 'webpage',
        tabId,
        text: `@webpage.${tabId}`
      })
    ]);
  });

  it('finds webpage click-point references with #x.y viewport coordinates', () => {
    const tabId = '44444444-4444-4444-4444-444444444444';

    expect(findAiScriptReferenceCandidates(`@webpage.${tabId}#100.200`)).toEqual([
      expect.objectContaining({
        kind: 'webpage',
        tabId,
        click: { x: 100, y: 200 },
        text: `@webpage.${tabId}#100.200`
      })
    ]);

    expect(findAiScriptReferenceCandidates(`@webpage.${tabId}#50.50`)).toEqual([
      expect.objectContaining({
        kind: 'webpage',
        click: { x: 50, y: 50 }
      })
    ]);

    expect(findAiScriptReferenceCandidates(`@webpage.${tabId}#200.100`)).toEqual([
      expect.objectContaining({
        kind: 'webpage',
        click: { x: 200, y: 100 }
      })
    ]);

    expect(buildWebpageReferenceToken(tabId)).toBe(`@webpage.${tabId}`);
    expect(buildWebpageReferenceToken(tabId, { x: 100.4, y: 200.6 })).toBe(
      `@webpage.${tabId}#100.201`
    );
  });

  it('rejects malformed collection, folder, request, and webpage references', () => {
    expect(findAiScriptReferenceCandidates('@collection.not-a-uuid')).toEqual([]);
    expect(findAiScriptReferenceCandidates('@folder.not-a-uuid')).toEqual([]);
    expect(findAiScriptReferenceCandidates('@request.not-a-uuid')).toEqual([]);
    expect(findAiScriptReferenceCandidates('@webpage.not-a-uuid')).toEqual([]);
  });

  it('finds response-section references by request tab uuid and section', () => {
    const tabId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    expect(findAiScriptReferenceCandidates(`@res.${tabId}.body`)).toEqual([
      expect.objectContaining({
        kind: 'response-section',
        requestTabId: tabId,
        section: 'body',
        text: `@res.${tabId}.body`
      })
    ]);
    expect(findAiScriptReferenceCandidates(`@res.${tabId}.headers`)).toEqual([
      expect.objectContaining({ kind: 'response-section', section: 'headers' })
    ]);
    expect(findAiScriptReferenceCandidates(`@res.${tabId}.timing`)).toEqual([
      expect.objectContaining({ kind: 'response-section', section: 'timing' })
    ]);
    expect(findAiScriptReferenceCandidates(`@res.${tabId}.console`)).toEqual([
      expect.objectContaining({ kind: 'response-section', section: 'console' })
    ]);
    expect(findAiScriptReferenceCandidates(`@res.${tabId}.tests`)).toEqual([
      expect.objectContaining({ kind: 'response-section', section: 'tests' })
    ]);
  });

  it('finds response body selection references with character offsets', () => {
    const tabId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const token = `@res.${tabId}.body#10.40`;

    expect(findAiScriptReferenceCandidates(token)).toEqual([
      expect.objectContaining({
        kind: 'response-section',
        requestTabId: tabId,
        section: 'body',
        text: token,
        selection: { start: 10, end: 40 }
      })
    ]);
  });

  it('rejects malformed response-section references', () => {
    expect(findAiScriptReferenceCandidates('@res.not-a-uuid.body')).toEqual([]);
    expect(
      findAiScriptReferenceCandidates('@res.aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.preview')
    ).toEqual([]);
    expect(findAiScriptReferenceCandidates('@res.aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toEqual(
      []
    );
  });
});

describe('isValidAiScriptReference', () => {
  it('accepts active references on a request tab', () => {
    const [candidate] = findAiScriptReferenceCandidates('@active.pre.1');
    expect(candidate).toBeDefined();
    expect(isValidAiScriptReference(candidate!, context())).toBe(true);
  });

  it('accepts numeric ids that match the active draft', () => {
    const [candidate] = findAiScriptReferenceCandidates('@42.post.1');
    expect(candidate).toBeDefined();
    expect(isValidAiScriptReference(candidate!, context())).toBe(true);
  });

  it('rejects references when there is no active request tab', () => {
    const [candidate] = findAiScriptReferenceCandidates('@active.pre.1');
    expect(candidate).toBeDefined();
    expect(isValidAiScriptReference(candidate!, context({ hasActiveRequestTab: false }))).toBe(
      false
    );
  });

  it('rejects numeric ids that do not match the active draft', () => {
    const [candidate] = findAiScriptReferenceCandidates('@99.pre.1');
    expect(candidate).toBeDefined();
    expect(isValidAiScriptReference(candidate!, context({ activeRequestId: 42 }))).toBe(false);
  });

  it('rejects out-of-range script indexes', () => {
    const [candidate] = findAiScriptReferenceCandidates('@active.pre.3');
    expect(candidate).toBeDefined();
    expect(isValidAiScriptReference(candidate!, context({ preScriptCount: 2 }))).toBe(false);
  });

  it('accepts request-script selection references when a matching snapshot exists without an active tab', () => {
    const token = '@active.post.1#0.25';
    const [candidate] = findAiScriptReferenceCandidates(token);
    expect(candidate).toBeDefined();
    expect(
      isValidAiScriptReference(
        candidate!,
        context({
          hasActiveRequestTab: false,
          scriptSelections: {
            [token]: {
              scriptLabel: 'Assert ok',
              phase: 'post',
              scriptIndex: 1,
              requestId: 'active',
              source: 'hc.expect(true).to.be.ok();',
              selectedText: 'hc.expect(true).to.be.ok();',
              startOffset: 0,
              endOffset: 25,
              startLine: 1,
              endLine: 1
            }
          }
        })
      )
    ).toBe(true);
  });

  it('rejects request-script selection references without a snapshot when the active tab mismatches', () => {
    const [candidate] = findAiScriptReferenceCandidates('@99.post.1#0.5');
    expect(candidate).toBeDefined();
    expect(isValidAiScriptReference(candidate!, context({ activeRequestId: 42 }))).toBe(false);
  });

  it('accepts snippet references when the uuid exists in the library', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const [candidate] = findAiScriptReferenceCandidates(`@snippet.${uuid}`);
    expect(candidate).toBeDefined();
    expect(
      isValidAiScriptReference(
        candidate!,
        context({
          hasActiveRequestTab: false,
          snippets: [snippet({ uuid })]
        })
      )
    ).toBe(true);
  });

  it('rejects snippet references when the uuid is not in the library', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const [candidate] = findAiScriptReferenceCandidates(`@snippet.${uuid}`);
    expect(candidate).toBeDefined();
    expect(isValidAiScriptReference(candidate!, context({ snippets: [] }))).toBe(false);
  });

  it('accepts terminal references when a matching snapshot exists', () => {
    const [candidate] = findAiScriptReferenceCandidates('@term.2#1.33');
    expect(candidate).toBeDefined();
    expect(
      isValidAiScriptReference(
        candidate!,
        context({
          terminalSelections: {
            '@term.2#1.33': {
              terminalLabel: 'Terminal 2',
              startLine: 1,
              endLine: 33,
              selectedText: 'error output',
              contextText: 'before\nerror output\nafter'
            }
          }
        })
      )
    ).toBe(true);
  });

  it('rejects terminal references without a stored snapshot', () => {
    const [candidate] = findAiScriptReferenceCandidates('@term.2#1.33');
    expect(candidate).toBeDefined();
    expect(isValidAiScriptReference(candidate!, context())).toBe(false);
  });

  it('accepts markdown references when a matching snapshot exists', () => {
    const markdownUuid = '44444444-4444-4444-4444-444444444444';
    const token = `@markdown.${markdownUuid}#10.42`;
    const [candidate] = findAiScriptReferenceCandidates(token);
    expect(candidate).toBeDefined();
    expect(
      isValidAiScriptReference(
        candidate!,
        context({
          markdownSelections: {
            [token]: {
              label: 'Document: README.md',
              selectedText: 'selected markdown',
              startOffset: 10,
              endOffset: 42,
              startLine: 2,
              endLine: 3
            }
          }
        })
      )
    ).toBe(true);
  });

  it('rejects markdown references without a stored snapshot', () => {
    const markdownUuid = '44444444-4444-4444-4444-444444444444';
    const [candidate] = findAiScriptReferenceCandidates(`@markdown.${markdownUuid}#10.42`);
    expect(candidate).toBeDefined();
    expect(isValidAiScriptReference(candidate!, context())).toBe(false);
  });

  it('accepts body references when a matching snapshot exists', () => {
    const token = '@body#10.42';
    const [candidate] = findAiScriptReferenceCandidates(token);
    expect(candidate).toBeDefined();
    expect(
      isValidAiScriptReference(
        candidate!,
        context({
          requestBodySelections: {
            [token]: {
              label: 'Raw multipart body',
              selectedText: 'selected raw body',
              startOffset: 10,
              endOffset: 42,
              startLine: 2,
              endLine: 3
            }
          }
        })
      )
    ).toBe(true);
  });

  it('rejects body references without a stored snapshot', () => {
    const [candidate] = findAiScriptReferenceCandidates('@body#10.42');
    expect(candidate).toBeDefined();
    expect(isValidAiScriptReference(candidate!, context())).toBe(false);
  });

  it('accepts response-section references when a matching snapshot exists', () => {
    const tabId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const token = `@res.${tabId}.body`;
    const [candidate] = findAiScriptReferenceCandidates(token);
    expect(candidate).toBeDefined();
    expect(
      isValidAiScriptReference(
        candidate!,
        context({
          responseSelections: {
            [token]: {
              label: 'Response body',
              requestName: 'Echo',
              section: 'body',
              status: 200,
              statusText: 'OK',
              content: '{"ok":true}'
            }
          }
        })
      )
    ).toBe(true);
  });

  it('rejects response-section references without a stored snapshot', () => {
    const [candidate] = findAiScriptReferenceCandidates(
      '@res.aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.body'
    );
    expect(candidate).toBeDefined();
    expect(isValidAiScriptReference(candidate!, context())).toBe(false);
  });

  it('accepts collection, folder, and request references when names are known', () => {
    const collectionUuid = '11111111-1111-1111-1111-111111111111';
    const folderUuid = '22222222-2222-2222-2222-222222222222';
    const requestUuid = '33333333-3333-3333-3333-333333333333';
    const nameContext = context({
      hasActiveRequestTab: false,
      collectionNamesByUuid: { [collectionUuid]: 'API' },
      folderNamesByUuid: { [folderUuid]: 'Auth' },
      requestNamesByUuid: { [requestUuid]: 'Login' }
    });

    const [collectionRef] = findAiScriptReferenceCandidates(`@collection.${collectionUuid}`);
    const [folderRef] = findAiScriptReferenceCandidates(`@folder.${folderUuid}`);
    const [requestRef] = findAiScriptReferenceCandidates(`@request.${requestUuid}`);

    expect(isValidAiScriptReference(collectionRef!, nameContext)).toBe(true);
    expect(isValidAiScriptReference(folderRef!, nameContext)).toBe(true);
    expect(isValidAiScriptReference(requestRef!, nameContext)).toBe(true);
  });

  it('accepts webpage references when the browser tab is open', () => {
    const tabId = '44444444-4444-4444-4444-444444444444';
    const webpageContext = context({
      hasActiveRequestTab: false,
      webpageTabsById: {
        [tabId]: { title: 'Example', url: 'https://example.com/' }
      }
    });
    const missingContext = context({ hasActiveRequestTab: false, webpageTabsById: {} });

    const [webpageRef] = findAiScriptReferenceCandidates(`@webpage.${tabId}`);

    expect(isValidAiScriptReference(webpageRef!, webpageContext)).toBe(true);
    expect(isValidAiScriptReference(webpageRef!, missingContext)).toBe(false);
  });
});

describe('resolveAiScriptReferenceName', () => {
  it('returns the inline script name when set', () => {
    const [candidate] = findAiScriptReferenceCandidates('@active.pre.1');
    expect(candidate).toBeDefined();

    expect(
      resolveAiScriptReferenceName(
        candidate!,
        context({
          preScripts: [inlineScript({ name: 'Set auth token' })]
        })
      )
    ).toBe('Set auth token');
  });

  it('returns the linked snippet name for snippet scripts', () => {
    const [candidate] = findAiScriptReferenceCandidates('@42.post.1');
    expect(candidate).toBeDefined();

    expect(
      resolveAiScriptReferenceName(
        candidate!,
        context({
          postScripts: [
            inlineScript({ id: 'script-2', kind: 'snippet', snippetUuid: 'snippet-uuid' })
          ],
          snippets: [snippet({ name: 'Auth helper' })]
        })
      )
    ).toBe('Auth helper');
  });

  it('returns Missing snippet when the linked snippet is absent', () => {
    const [candidate] = findAiScriptReferenceCandidates('@42.post.1');
    expect(candidate).toBeDefined();

    expect(
      resolveAiScriptReferenceName(
        candidate!,
        context({
          postScripts: [
            inlineScript({ id: 'script-2', kind: 'snippet', snippetUuid: 'missing-uuid' })
          ],
          snippets: []
        })
      )
    ).toBe('Missing snippet');
  });

  it('returns null for out-of-range references', () => {
    const [candidate] = findAiScriptReferenceCandidates('@active.pre.3');
    expect(candidate).toBeDefined();

    expect(
      resolveAiScriptReferenceName(
        candidate!,
        context({
          preScripts: [
            inlineScript({ name: 'First' }),
            inlineScript({ id: 'script-2', name: 'Second' })
          ]
        })
      )
    ).toBeNull();
  });

  it('returns the snippet name for standalone snippet references', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const [candidate] = findAiScriptReferenceCandidates(`@snippet.${uuid}`);
    expect(candidate).toBeDefined();

    expect(
      resolveAiScriptReferenceName(
        candidate!,
        context({
          hasActiveRequestTab: false,
          snippets: [snippet({ uuid, name: 'Auth helper' })]
        })
      )
    ).toBe('Auth helper');
  });

  it('returns the response-section label from the snapshot', () => {
    const tabId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const token = `@res.${tabId}.tests`;
    const [candidate] = findAiScriptReferenceCandidates(token);
    expect(candidate).toBeDefined();

    expect(
      resolveAiScriptReferenceName(
        candidate!,
        context({
          responseSelections: {
            [token]: {
              label: 'Response tests',
              requestName: 'Echo',
              section: 'tests',
              content: '1/1 passed'
            }
          }
        })
      )
    ).toBe('Response tests');
  });
});

describe('resolveAiScriptReferenceLabel', () => {
  it('returns the script name when no selection suffix is present', () => {
    const [candidate] = findAiScriptReferenceCandidates('@active.pre.1');
    expect(candidate).toBeDefined();

    expect(
      resolveAiScriptReferenceLabel(
        candidate!,
        context({
          preScripts: [inlineScript({ name: 'Set auth token', code: 'line1\nline2\nline3' })]
        })
      )
    ).toBe('Set auth token');
  });

  it('appends a single-line range when the selection stays on one line', () => {
    const [candidate] = findAiScriptReferenceCandidates('@active.pre.1#6.11');
    expect(candidate).toBeDefined();

    expect(
      resolveAiScriptReferenceLabel(
        candidate!,
        context({
          preScripts: [inlineScript({ name: 'Set auth token', code: 'line1\nline2\nline3' })]
        })
      )
    ).toBe('Set auth token (line 2)');
  });

  it('appends a multi-line range when the selection spans lines', () => {
    const [candidate] = findAiScriptReferenceCandidates('@42.post.1#0.12');
    expect(candidate).toBeDefined();

    expect(
      resolveAiScriptReferenceLabel(
        candidate!,
        context({
          postScripts: [inlineScript({ name: 'Assert status', code: 'line1\nline2\nline3' })]
        })
      )
    ).toBe('Assert status (lines 1-2)');
  });

  it('resolves badge labels from a script selection snapshot when the active tab mismatches', () => {
    const token = '@active.post.1#0.25';
    const [candidate] = findAiScriptReferenceCandidates(token);
    expect(candidate).toBeDefined();

    expect(
      resolveAiScriptReferenceLabel(
        candidate!,
        context({
          hasActiveRequestTab: false,
          activeRequestId: 99,
          scriptSelections: {
            [token]: {
              scriptLabel: 'Assert ok',
              phase: 'post',
              scriptIndex: 1,
              requestId: 'active',
              source: 'hc.expect(true).to.be.ok();',
              selectedText: 'hc.expect(true).to.be.ok();',
              startOffset: 0,
              endOffset: 25,
              startLine: 1,
              endLine: 1
            }
          }
        })
      )
    ).toBe('Assert ok (line 1)');
  });

  it('falls back to the script name when snippet source is unavailable', () => {
    const [candidate] = findAiScriptReferenceCandidates('@42.post.1#0.4');
    expect(candidate).toBeDefined();

    expect(
      resolveAiScriptReferenceLabel(
        candidate!,
        context({
          postScripts: [
            inlineScript({ id: 'script-2', kind: 'snippet', snippetUuid: 'missing-uuid' })
          ],
          snippets: []
        })
      )
    ).toBe('Missing snippet');
  });

  it('appends line range for standalone snippet references with selections', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const [candidate] = findAiScriptReferenceCandidates(`@snippet.${uuid}#6.11`);
    expect(candidate).toBeDefined();

    expect(
      resolveAiScriptReferenceLabel(
        candidate!,
        context({
          hasActiveRequestTab: false,
          snippets: [snippet({ uuid, name: 'Auth helper', code: 'line1\nline2\nline3' })]
        })
      )
    ).toBe('Auth helper (line 2)');
  });

  it('returns the terminal label with a line span for terminal references', () => {
    const [candidate] = findAiScriptReferenceCandidates('@term.2#1.33');
    expect(candidate).toBeDefined();

    expect(
      resolveAiScriptReferenceLabel(
        candidate!,
        context({
          terminalSelections: {
            '@term.2#1.33': {
              terminalLabel: 'Build shell',
              startLine: 1,
              endLine: 33,
              selectedText: 'error output',
              contextText: 'before\nerror output\nafter'
            }
          }
        })
      )
    ).toBe('Build shell (lines 1-33)');
  });

  it('returns the markdown label with a line span for markdown references', () => {
    const markdownUuid = '44444444-4444-4444-4444-444444444444';
    const token = `@markdown.${markdownUuid}#10.42`;
    const [candidate] = findAiScriptReferenceCandidates(token);
    expect(candidate).toBeDefined();

    expect(
      resolveAiScriptReferenceLabel(
        candidate!,
        context({
          markdownSelections: {
            [token]: {
              label: 'Document: README.md',
              selectedText: 'selected markdown',
              startOffset: 10,
              endOffset: 42,
              startLine: 2,
              endLine: 4
            }
          }
        })
      )
    ).toBe('Document: README.md (lines 2-4)');
  });

  it('returns the response body label with a line span for body selection references', () => {
    const tabId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const token = `@res.${tabId}.body#10.40`;
    const [candidate] = findAiScriptReferenceCandidates(token);
    expect(candidate).toBeDefined();

    expect(
      resolveAiScriptReferenceLabel(
        candidate!,
        context({
          responseSelections: {
            [token]: {
              label: 'Response body',
              requestName: 'Echo',
              section: 'body',
              content: '{\n  "cookies": {},\n  "data": "x"\n}',
              selectedText: '"cookies": {},\n  "data": "x"',
              startOffset: 10,
              endOffset: 40,
              startLine: 2,
              endLine: 3
            }
          }
        })
      )
    ).toBe('Response body (lines 2-3)');
  });

  it('returns prefixed labels for collection, folder, and request references', () => {
    const collectionUuid = '11111111-1111-1111-1111-111111111111';
    const folderUuid = '22222222-2222-2222-2222-222222222222';
    const requestUuid = '33333333-3333-3333-3333-333333333333';
    const nameContext = context({
      hasActiveRequestTab: false,
      collectionNamesByUuid: { [collectionUuid]: 'API' },
      folderNamesByUuid: { [folderUuid]: 'Auth' },
      requestNamesByUuid: { [requestUuid]: 'Login' }
    });

    const [collectionRef] = findAiScriptReferenceCandidates(`@collection.${collectionUuid}`);
    const [folderRef] = findAiScriptReferenceCandidates(`@folder.${folderUuid}`);
    const [requestRef] = findAiScriptReferenceCandidates(`@request.${requestUuid}`);

    expect(resolveAiScriptReferenceLabel(collectionRef!, nameContext)).toBe('Collection: API');
    expect(resolveAiScriptReferenceLabel(folderRef!, nameContext)).toBe('Folder: Auth');
    expect(resolveAiScriptReferenceLabel(requestRef!, nameContext)).toBe('Request: Login');
  });

  it('returns the browser tab title for webpage references', () => {
    const tabId = '44444444-4444-4444-4444-444444444444';
    const webpageContext = context({
      hasActiveRequestTab: false,
      webpageTabsById: {
        [tabId]: { title: 'Example Domain', url: 'https://example.com/' }
      }
    });
    const untitledContext = context({
      hasActiveRequestTab: false,
      webpageTabsById: {
        [tabId]: { title: '  ', url: 'https://example.com/' }
      }
    });

    const [webpageRef] = findAiScriptReferenceCandidates(`@webpage.${tabId}`);
    const [clickRef] = findAiScriptReferenceCandidates(`@webpage.${tabId}#120.80`);

    expect(resolveAiScriptReferenceLabel(webpageRef!, webpageContext)).toBe('Example Domain');
    expect(resolveAiScriptReferenceLabel(webpageRef!, untitledContext)).toBe(
      'https://example.com/'
    );
    expect(resolveAiScriptReferenceLabel(clickRef!, webpageContext)).toBe(
      'Example Domain (120, 80)'
    );
  });
});

describe('tokenizeChatComposerText', () => {
  it('highlights only valid references', () => {
    const [candidate] = findAiScriptReferenceCandidates('@active.pre.1');
    expect(tokenizeChatComposerText('@active.pre.1', context())).toEqual([
      { text: '@active.pre.1', highlight: true, reference: candidate }
    ]);

    expect(tokenizeChatComposerText('@active.pre.9', context())).toEqual([
      { text: '@active.pre.9', highlight: false }
    ]);
  });

  it('splits mixed plain and highlighted segments', () => {
    const candidates = findAiScriptReferenceCandidates('Fix @42.pre.2 and @42.pre.9');
    expect(tokenizeChatComposerText('Fix @42.pre.2 and @42.pre.9', context())).toEqual([
      { text: 'Fix ', highlight: false },
      { text: '@42.pre.2', highlight: true, reference: candidates[0] },
      { text: ' and ', highlight: false },
      { text: '@42.pre.9', highlight: false }
    ]);
  });

  it('leaves trailing plain text after a parsed reference', () => {
    const [candidate] = findAiScriptReferenceCandidates('@active.pre.1extra');
    expect(tokenizeChatComposerText('@active.pre.1extra', context())).toEqual([
      { text: '@active.pre.1', highlight: true, reference: candidate },
      { text: 'extra', highlight: false }
    ]);
  });

  it('leaves invalid syntax as plain text', () => {
    expect(tokenizeChatComposerText('email@example.com', context())).toEqual([
      { text: 'email@example.com', highlight: false }
    ]);
  });
});

describe('buildAiScriptSelectionContextMessage', () => {
  const fullScript = 'line1\nline2\nline3';

  it('returns null when the message has no script references', () => {
    expect(buildAiScriptSelectionContextMessage('Explain login flow', context())).toBeNull();
  });

  it('includes whole-script source when references have no selection suffix', () => {
    const scriptWithTests = `hc.test('first', () => {});\nhc.test('second', () => {});`;
    const message = buildAiScriptSelectionContextMessage(
      'How many tests are in that script? @active.post.1',
      context({
        postScripts: [inlineScript({ name: 'Success Response', code: scriptWithTests })]
      })
    );

    expect(message).not.toBeNull();
    expect(message).toContain(
      'The user referenced one or more scripts via @ mentions. Use the script sources below to answer their question.'
    );
    expect(message).toContain('Reference @active.post.1');
    expect(message).toContain('script "Success Response"');
    expect(message).toContain('Full script source:');
    expect(message).toContain(scriptWithTests);
    expect(message).toContain('Answer using the referenced script source below.');
    expect(message).not.toContain('Selected text');
    expect(message).toContain('update_request_script');
  });

  it('returns null when whole-script references fail validation', () => {
    expect(
      buildAiScriptSelectionContextMessage(
        'Fix @active.pre.9 please',
        context({
          preScripts: [inlineScript({ name: 'Set auth token', code: fullScript })]
        })
      )
    ).toBeNull();
  });

  it('returns null when the selection reference fails active-tab validation', () => {
    expect(
      buildAiScriptSelectionContextMessage(
        'Fix @active.pre.9#0.5 please',
        context({
          preScripts: [inlineScript({ name: 'Set auth token', code: fullScript })]
        })
      )
    ).toBeNull();
  });

  it('includes snapshot script source when the active tab is gone', () => {
    const token = '@active.post.1#0.25';
    const source = 'hc.expect(true).to.be.ok();';
    const message = buildAiScriptSelectionContextMessage(
      `What is wrong with ${token}?`,
      context({
        hasActiveRequestTab: false,
        scriptSelections: {
          [token]: {
            scriptLabel: 'Assert ok',
            phase: 'post',
            scriptIndex: 1,
            requestId: 'active',
            source,
            selectedText: source,
            startOffset: 0,
            endOffset: 25,
            startLine: 1,
            endLine: 1
          }
        }
      })
    );

    expect(message).not.toBeNull();
    expect(message).toContain(
      'The user selected part of a script and is asking specifically about the SELECTED TEXT below.'
    );
    expect(message).toContain(`Reference ${token}`);
    expect(message).toContain('script "Assert ok"');
    expect(message).toContain('Full script source with selection markers');
    expect(message).toContain(`<<<SEL>>>${source.slice(0, 25)}<<</SEL>>>`);
    expect(message).toContain('Selected text (characters 0–25, line 1):');
    expect(message).toContain('Selection shape: partial expression.');
    expect(message).toContain('Focus your answer on the selected region.');
    expect(message).toContain('update_request_script');
    expect(message).toContain('replace_range');
    expect(message).toContain('Do not remove code outside the selection');
  });

  it('includes last-run failure details from the selection snapshot', () => {
    const source = 'hc.expect(true).to.be.ok;';
    const token = '@active.post.1#0.25';
    const message = buildAiScriptSelectionContextMessage(
      `Why am I being told that isn't a function? ${token}`,
      context({
        hasActiveRequestTab: false,
        scriptSelections: {
          [token]: {
            scriptLabel: 'Assert ok',
            phase: 'post',
            scriptIndex: 1,
            requestId: 'active',
            source,
            selectedText: source,
            startOffset: 0,
            endOffset: 25,
            startLine: 1,
            endLine: 1,
            lastRunFailure: {
              kind: 'script-error',
              message: 'expected false to be truthy',
              line: 1,
              column: 1,
              source: 'script.js'
            }
          }
        }
      })
    );

    expect(message).not.toBeNull();
    expect(message).toContain('Last run error:');
    expect(message).toContain('Script runtime error: expected false to be truthy');
    expect(message).toContain('Location: script.js:1:1');
  });

  it('includes full source, selected substring, line span, and focus wording', () => {
    const message = buildAiScriptSelectionContextMessage(
      'What does this do? @active.pre.1#6.11',
      context({
        preScripts: [inlineScript({ name: 'Set auth token', code: fullScript })]
      })
    );

    expect(message).not.toBeNull();
    expect(message).toContain(
      'The user selected part of a script and is asking specifically about the SELECTED TEXT below.'
    );
    expect(message).toContain('Reference @active.pre.1#6.11');
    expect(message).toContain('script "Set auth token"');
    expect(message).toContain('Full script source with selection markers');
    expect(message).toContain('line1\n<<<SEL>>>line2<<</SEL>>>\nline3');
    expect(message).toContain('Selected text (characters 6–11, line 2):');
    expect(message).toContain('line2');
    expect(message).toContain('Focus your answer on the selected region.');
    expect(message).toContain('update_request_script');
    expect(message).toContain('replace_range');
  });

  it('shows partial-expression boundaries beside unchanged chained text', () => {
    const source = `// Test
hc.test("Status code is 2xx", () => {
  hc.expect(hc.response.code).to.be(200);
});`;
    const selectedText = 'hc.expect(hc.response.code)';
    const startOffset = source.indexOf(selectedText);
    const endOffset = startOffset + selectedText.length;
    const token = `@active.post.1#${startOffset}.${endOffset}`;
    const message = buildAiScriptSelectionContextMessage(
      `Fix ${token}`,
      context({
        postScripts: [inlineScript({ name: 'Status assertion', code: source })]
      })
    );

    expect(message).toContain(`<<<SEL>>>${selectedText}<<</SEL>>>.to.be(200);`);
    expect(message).toContain('Selection shape: partial expression.');
    expect(message).toContain('replace_range code must itself be an expression');
    expect(message).toContain('mentally concatenate the text before the selection');
  });

  it('includes multi-line selection spans in the context block', () => {
    const message = buildAiScriptSelectionContextMessage(
      'Review @42.post.1#0.12',
      context({
        postScripts: [inlineScript({ name: 'Assert status', code: fullScript })]
      })
    );

    expect(message).not.toBeNull();
    expect(message).toContain('Selected text (characters 0–12, lines 1-2):');
    expect(message).toContain('line1\nline2');
    expect(message).toContain('of request id 42');
  });

  it('includes snippet source, selection, and no-edit-tool guidance', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const snippetCode = 'line1\nline2\nline3';
    const message = buildAiScriptSelectionContextMessage(
      `Review @snippet.${uuid}#6.11`,
      context({
        hasActiveRequestTab: false,
        snippets: [snippet({ uuid, name: 'Auth helper', code: snippetCode })]
      })
    );

    expect(message).not.toBeNull();
    expect(message).toContain(`Reference @snippet.${uuid}#6.11`);
    expect(message).toContain('standalone library snippet "Auth helper"');
    expect(message).toContain('Full snippet source with selection markers');
    expect(message).toContain('line1\n<<<SEL>>>line2<<</SEL>>>\nline3');
    expect(message).toContain('Selected text (characters 6–11, line 2):');
    expect(message).toContain('line2');
    expect(message).toContain('cannot be edited via tools');
    expect(message).toContain('paste back into the snippet editor');
    expect(message).not.toContain('update_request_script');
  });

  it('includes terminal selection, surrounding context, and terminal guidance', () => {
    const message = buildAiScriptSelectionContextMessage(
      'What failed here? @term.2#1.33',
      context({
        terminalSelections: {
          '@term.2#1.33': {
            terminalLabel: 'Build shell',
            startLine: 1,
            endLine: 33,
            selectedText: 'error output',
            contextText: 'before\nerror output\nafter'
          }
        }
      })
    );

    expect(message).not.toBeNull();
    expect(message).toContain(
      'The user selected terminal output and is asking specifically about the SELECTED TEXT below.'
    );
    expect(message).toContain('Reference @term.2#1.33');
    expect(message).toContain('footer terminal "Build shell"');
    expect(message).toContain('Selected terminal output (lines 1-33):');
    expect(message).toContain('error output');
    expect(message).toContain('Surrounding terminal context');
    expect(message).toContain('before\nerror output\nafter');
    expect(message).toContain('Terminal output references cannot be edited via tools');
    expect(message).not.toContain('update_request_script');
  });

  it('includes markdown selection text and get_markdown_document guidance', () => {
    const markdownUuid = '44444444-4444-4444-4444-444444444444';
    const token = `@markdown.${markdownUuid}#10.42`;
    const message = buildAiScriptSelectionContextMessage(
      `Explain this @markdown.${markdownUuid}#10.42`,
      context({
        markdownSelections: {
          [token]: {
            label: 'Comment: Echo',
            selectedText: 'selected markdown',
            startOffset: 10,
            endOffset: 42,
            startLine: 2,
            endLine: 2
          }
        }
      })
    );

    expect(message).toContain(
      'The user selected markdown text and is asking specifically about the SELECTED TEXT below.'
    );
    expect(message).toContain(`Reference ${token}`);
    expect(message).toContain('markdown "Comment: Echo"');
    expect(message).toContain('Selected markdown text');
    expect(message).toContain('selected markdown');
    expect(message).toContain('get_markdown_document');
    expect(message).toContain('cannot be edited via tools');
  });

  it('includes raw body selection text and update_active_request guidance', () => {
    const token = '@body#10.42';
    const message = buildAiScriptSelectionContextMessage(
      'Fix this @body#10.42',
      context({
        requestBodySelections: {
          [token]: {
            label: 'Raw urlencoded body',
            selectedText: 'foo=bar&baz=1',
            startOffset: 10,
            endOffset: 42,
            startLine: 1,
            endLine: 1
          }
        }
      })
    );

    expect(message).toContain(
      'The user selected raw request body text and is asking specifically about the SELECTED TEXT below.'
    );
    expect(message).toContain(`Reference ${token}`);
    expect(message).toContain('raw request body "Raw urlencoded body"');
    expect(message).toContain('foo=bar&baz=1');
    expect(message).toContain('get_active_request_details');
    expect(message).toContain('update_active_request');
    expect(message).toContain('body_raw');
  });

  it('includes response-section content and tool fallback guidance', () => {
    const tabId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const token = `@res.${tabId}.headers`;
    const message = buildAiScriptSelectionContextMessage(
      `Explain ${token}`,
      context({
        responseSelections: {
          [token]: {
            label: 'Response headers',
            requestName: 'Echo',
            section: 'headers',
            status: 200,
            statusText: 'OK',
            content: 'content-type: application/json'
          }
        }
      })
    );

    expect(message).toContain(
      'The user referenced one or more HTTP response sections via @res mentions.'
    );
    expect(message).toContain(`Reference ${token}`);
    expect(message).toContain('Response headers for request "Echo"');
    expect(message).toContain('Status: 200 OK');
    expect(message).toContain('content-type: application/json');
    expect(message).toContain('get_active_response');
    expect(message).toContain('cannot be edited via tools');
  });

  it('includes selected response body text and tool guidance for body selections', () => {
    const tabId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const token = `@res.${tabId}.body#14.48`;
    const message = buildAiScriptSelectionContextMessage(
      `Explain ${token}`,
      context({
        responseSelections: {
          [token]: {
            label: 'Response body',
            requestName: 'Echo',
            section: 'body',
            status: 200,
            statusText: 'OK',
            content: '{\n  "cookies": {},\n  "data": "[...]"\n}',
            selectedText: '"cookies": {},\n  "data": "[...]"',
            startOffset: 14,
            endOffset: 48,
            startLine: 2,
            endLine: 3
          }
        }
      })
    );

    expect(message).toContain(
      'The user selected part of an HTTP response body and is asking specifically about the SELECTED TEXT below.'
    );
    expect(message).toContain(`Reference ${token}`);
    expect(message).toContain('Selected response body text');
    expect(message).toContain('pretty-printed body viewer text');
    expect(message).toContain('"cookies": {},');
    expect(message).toContain('get_active_request');
    expect(message).toContain('get_active_response');
    expect(message).toContain('query_response_body');
    expect(message).toContain('@res.<tab-uuid>.body#start.end');
  });

  it('returns null for collection, folder, and request references', () => {
    const collectionUuid = '11111111-1111-1111-1111-111111111111';
    const folderUuid = '22222222-2222-2222-2222-222222222222';
    const requestUuid = '33333333-3333-3333-3333-333333333333';

    expect(
      buildAiScriptSelectionContextMessage(
        `Review @collection.${collectionUuid} @folder.${folderUuid} @request.${requestUuid}`,
        context({
          hasActiveRequestTab: false,
          collectionNamesByUuid: { [collectionUuid]: 'API' },
          folderNamesByUuid: { [folderUuid]: 'Auth' },
          requestNamesByUuid: { [requestUuid]: 'Login' }
        })
      )
    ).toBeNull();
  });

  it('includes webpage title, url, and tool guidance', () => {
    const tabId = '44444444-4444-4444-4444-444444444444';
    const token = `@webpage.${tabId}`;
    const message = buildAiScriptSelectionContextMessage(
      `Inspect ${token}`,
      context({
        hasActiveRequestTab: false,
        webpageTabsById: {
          [tabId]: { title: 'Example Domain', url: 'https://example.com/' }
        }
      })
    );

    expect(message).toContain(`Reference ${token}`);
    expect(message).toContain('embedded browser tab "Example Domain"');
    expect(message).toContain(`tabId: ${tabId}`);
    expect(message).toContain('url: https://example.com/');
    expect(message).toContain('webpage_tab');
    expect(message).toContain('webpage_query');
  });

  it('includes elementFromPoint guidance for webpage click-point references', () => {
    const tabId = '44444444-4444-4444-4444-444444444444';
    const token = `@webpage.${tabId}#100.200`;
    const message = buildAiScriptSelectionContextMessage(
      `What is this? ${token}`,
      context({
        hasActiveRequestTab: false,
        webpageTabsById: {
          [tabId]: { title: 'Example Domain', url: 'https://example.com/' }
        }
      })
    );

    expect(message).toContain(`Reference ${token}`);
    expect(message).toContain('click: 100,200');
    expect(message).toContain('document.elementFromPoint(100, 200)');
    expect(message).toContain('webpage_evaluate');
  });
});

describe('stripAiScriptReferences', () => {
  it('removes a single script reference token', () => {
    expect(stripAiScriptReferences('Fix @33.pre.3 auth')).toBe('Fix auth');
  });

  it('removes selection suffixes with the reference token', () => {
    expect(stripAiScriptReferences('Fix @33.pre.3#10.20 auth')).toBe('Fix auth');
  });

  it('removes snippet reference tokens', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(stripAiScriptReferences(`Fix @snippet.${uuid}#10.20 auth`)).toBe('Fix auth');
  });

  it('removes multiple script reference tokens', () => {
    expect(stripAiScriptReferences('Check @42.pre.2 and @42.post.1')).toBe('Check and');
  });

  it('returns an empty string when the message contains only script references', () => {
    expect(stripAiScriptReferences('@active.pre.1')).toBe('');
  });

  it('leaves plain text unchanged when no script references are present', () => {
    expect(stripAiScriptReferences('Explain login flow')).toBe('Explain login flow');
  });

  it('does not strip email addresses or references without a leading boundary', () => {
    expect(stripAiScriptReferences('email@example.com')).toBe('email@example.com');
    expect(stripAiScriptReferences('foo@active.pre.1')).toBe('foo@active.pre.1');
  });

  it('removes only the parsed reference prefix when extra text follows', () => {
    expect(stripAiScriptReferences('@active.pre.1extra')).toBe('extra');
  });
});

describe('collectChatReferenceSnapshots', () => {
  it('collects response-section snapshots keyed by token', () => {
    const tabId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const token = `@res.${tabId}.body`;
    const snapshot = {
      label: 'Response body',
      requestName: 'Echo',
      section: 'body' as const,
      status: 200,
      content: '{"ok":true}'
    };

    expect(
      collectChatReferenceSnapshots(
        `Explain ${token}`,
        context({
          responseSelections: { [token]: snapshot }
        })
      )
    ).toEqual({
      [token]: { kind: 'response-section', snapshot }
    });
  });

  it('collects response body selection snapshots keyed by the full token including offsets', () => {
    const tabId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const token = `@res.${tabId}.body#10.40`;
    const snapshot = {
      label: 'Response body',
      requestName: 'Echo',
      section: 'body' as const,
      status: 200,
      content: '{\n  "ok": true\n}',
      selectedText: '"ok": true',
      startOffset: 10,
      endOffset: 40,
      startLine: 2,
      endLine: 2
    };

    expect(
      collectChatReferenceSnapshots(
        `Explain ${token}`,
        context({
          responseSelections: { [token]: snapshot }
        })
      )
    ).toEqual({
      [token]: { kind: 'response-section', snapshot }
    });
  });

  it('collects existing script-selection snapshots for selection refs', () => {
    const token = '@99.post.1#0.25';
    const snapshot = {
      scriptLabel: 'Assert ok',
      phase: 'post' as const,
      scriptIndex: 1,
      requestId: 99 as const,
      source: 'hc.expect(true).to.be.ok();',
      selectedText: 'hc.expect(true).to.be.ok();',
      startOffset: 0,
      endOffset: 25,
      startLine: 1,
      endLine: 1
    };

    expect(
      collectChatReferenceSnapshots(
        token,
        context({
          hasActiveRequestTab: false,
          scriptSelections: { [token]: snapshot }
        })
      )
    ).toEqual({
      [token]: { kind: 'script-selection', snapshot }
    });
  });

  it('builds a whole-script snapshot from the live tab when no selection snapshot exists', () => {
    const source = 'hc.test("ok", () => true);';
    const collected = collectChatReferenceSnapshots(
      '@active.post.1',
      context({
        postScriptCount: 1,
        postScripts: [inlineScript({ code: source, name: 'SendSuccess' })]
      })
    );

    expect(collected).toEqual({
      '@active.post.1': {
        kind: 'script-selection',
        snapshot: {
          scriptLabel: 'SendSuccess',
          phase: 'post',
          scriptIndex: 1,
          requestId: 'active',
          source,
          selectedText: source,
          startOffset: 0,
          endOffset: source.length,
          startLine: 1,
          endLine: 1
        }
      }
    });
  });

  it('returns undefined when the message has no snapshot-backed references', () => {
    expect(collectChatReferenceSnapshots('hello', context())).toBeUndefined();
  });
});

describe('whole-script scriptSelections validation', () => {
  it('accepts whole-script references when a matching snapshot exists without an active tab', () => {
    const token = '@active.post.1';
    const [candidate] = findAiScriptReferenceCandidates(token);
    expect(candidate).toBeDefined();
    expect(
      isValidAiScriptReference(
        candidate!,
        context({
          hasActiveRequestTab: false,
          scriptSelections: {
            [token]: {
              scriptLabel: 'SendSuccess',
              phase: 'post',
              scriptIndex: 1,
              requestId: 'active',
              source: 'hc.test("ok", () => true);',
              selectedText: 'hc.test("ok", () => true);',
              startOffset: 0,
              endOffset: 26,
              startLine: 1,
              endLine: 1
            }
          }
        })
      )
    ).toBe(true);
    expect(
      resolveAiScriptReferenceLabel(
        candidate!,
        context({
          hasActiveRequestTab: false,
          scriptSelections: {
            [token]: {
              scriptLabel: 'SendSuccess',
              phase: 'post',
              scriptIndex: 1,
              requestId: 'active',
              source: 'hc.test("ok", () => true);',
              selectedText: 'hc.test("ok", () => true);',
              startOffset: 0,
              endOffset: 26,
              startLine: 1,
              endLine: 1
            }
          }
        })
      )
    ).toBe('SendSuccess');
  });
});
