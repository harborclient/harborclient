import { describe, expect, it } from 'vitest';
import {
  normalizeSnippetScope,
  snippetMatchesPhase,
  snippetScopeForPhase,
  snippetScopeLabel
} from './snippetScope';

describe('snippetScopeForPhase', () => {
  it('maps pre to pre-request', () => {
    expect(snippetScopeForPhase('pre')).toBe('pre-request');
  });

  it('maps post to post-request', () => {
    expect(snippetScopeForPhase('post')).toBe('post-request');
  });
});

describe('snippetMatchesPhase', () => {
  it('allows any scope in both phases', () => {
    expect(snippetMatchesPhase('any', 'pre')).toBe(true);
    expect(snippetMatchesPhase('any', 'post')).toBe(true);
  });

  it('matches pre-request only on pre phase', () => {
    expect(snippetMatchesPhase('pre-request', 'pre')).toBe(true);
    expect(snippetMatchesPhase('pre-request', 'post')).toBe(false);
  });

  it('matches post-request only on post phase', () => {
    expect(snippetMatchesPhase('post-request', 'post')).toBe(true);
    expect(snippetMatchesPhase('post-request', 'pre')).toBe(false);
  });
});

describe('normalizeSnippetScope', () => {
  it('returns valid scopes unchanged', () => {
    expect(normalizeSnippetScope('pre-request')).toBe('pre-request');
    expect(normalizeSnippetScope('post-request')).toBe('post-request');
    expect(normalizeSnippetScope('any')).toBe('any');
  });

  it('defaults unknown values to any', () => {
    expect(normalizeSnippetScope('invalid')).toBe('any');
    expect(normalizeSnippetScope(null)).toBe('any');
  });
});

describe('snippetScopeLabel', () => {
  it('returns labels for known scopes', () => {
    expect(snippetScopeLabel('pre-request')).toBe('Pre-request');
    expect(snippetScopeLabel('post-request')).toBe('Post-request');
    expect(snippetScopeLabel('any')).toBe('Any');
  });
});
