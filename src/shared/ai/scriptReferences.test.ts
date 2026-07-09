import { describe, expect, it } from 'vitest';
import {
  findAiScriptReferenceCandidates,
  isValidAiScriptReference,
  resolveAiScriptReferenceName,
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
