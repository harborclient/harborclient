import { describe, expect, it } from 'vitest';
import { deriveMarketplaceSnippetUuid, resolveMarketplaceSnippetUuid } from './snippetUuid';

describe('deriveMarketplaceSnippetUuid', () => {
  it('returns the same UUID for the same catalog id and key', () => {
    const first = deriveMarketplaceSnippetUuid('com.example.snippets.tester', 'Tester');
    const second = deriveMarketplaceSnippetUuid('com.example.snippets.tester', 'Tester');
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('returns different UUIDs for different keys in the same bundle', () => {
    const first = deriveMarketplaceSnippetUuid('com.example.snippets.tester', 'Tester');
    const second = deriveMarketplaceSnippetUuid('com.example.snippets.tester', 'Other');
    expect(first).not.toBe(second);
  });
});

describe('resolveMarketplaceSnippetUuid', () => {
  it('prefers an explicit manifest uuid when provided', () => {
    expect(
      resolveMarketplaceSnippetUuid(
        'com.example.snippets.tester',
        '11111111-2222-4333-8444-555555555555',
        'Tester'
      )
    ).toBe('11111111-2222-4333-8444-555555555555');
  });
});
