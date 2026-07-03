import { describe, expect, it } from 'vitest';
import {
  findAiScriptReferenceCandidates,
  isValidAiScriptReference,
  tokenizeChatComposerText,
  type AiScriptReferenceValidationContext
} from '#/shared/aiScriptReferences';

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

describe('tokenizeChatComposerText', () => {
  it('highlights only valid references', () => {
    expect(tokenizeChatComposerText('@active.pre.1', context())).toEqual([
      { text: '@active.pre.1', highlight: true }
    ]);

    expect(tokenizeChatComposerText('@active.pre.9', context())).toEqual([
      { text: '@active.pre.9', highlight: false }
    ]);
  });

  it('splits mixed plain and highlighted segments', () => {
    expect(tokenizeChatComposerText('Fix @42.pre.2 and @42.pre.9', context())).toEqual([
      { text: 'Fix ', highlight: false },
      { text: '@42.pre.2', highlight: true },
      { text: ' and ', highlight: false },
      { text: '@42.pre.9', highlight: false }
    ]);
  });

  it('leaves trailing plain text after a parsed reference', () => {
    expect(tokenizeChatComposerText('@active.pre.1extra', context())).toEqual([
      { text: '@active.pre.1', highlight: true },
      { text: 'extra', highlight: false }
    ]);
  });

  it('leaves invalid syntax as plain text', () => {
    expect(tokenizeChatComposerText('email@example.com', context())).toEqual([
      { text: 'email@example.com', highlight: false }
    ]);
  });
});
