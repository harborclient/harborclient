import { describe, expect, it } from 'vitest';
import {
  buildAiScriptSelectionContextMessage,
  findAiScriptReferenceCandidates,
  isValidAiScriptReference,
  resolveAiScriptReferenceLabel,
  resolveAiScriptReferenceName,
  stripAiScriptReferences,
  tokenizeChatComposerText,
  type AiScriptReferenceValidationContext
} from '#/shared/ai/scriptReferences';
import type { ScriptRef, Snippet } from '#/shared/types';

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

  it('rejects malformed collection, folder, and request references', () => {
    expect(findAiScriptReferenceCandidates('@collection.not-a-uuid')).toEqual([]);
    expect(findAiScriptReferenceCandidates('@folder.not-a-uuid')).toEqual([]);
    expect(findAiScriptReferenceCandidates('@request.not-a-uuid')).toEqual([]);
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

  it('returns null when references have no selection suffix', () => {
    expect(buildAiScriptSelectionContextMessage('Fix @active.pre.1 please', context())).toBeNull();
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
    expect(message).toContain('Full script source:');
    expect(message).toContain(fullScript);
    expect(message).toContain('Selected text (characters 6–11, line 2):');
    expect(message).toContain('line2');
    expect(message).toContain('Focus your answer on the selected region.');
    expect(message).toContain('update_request_script');
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
    expect(message).toContain('Full snippet source:');
    expect(message).toContain(snippetCode);
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
