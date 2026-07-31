import { describe, expect, it } from 'vitest';
import { resolveCollectionStorageBadge } from './collectionStorageBadge';

describe('resolveCollectionStorageBadge', () => {
  it('returns http for URL-backed collections regardless of storage', () => {
    expect(
      resolveCollectionStorageBadge('https://example.com/collection.json', 'git', 'Git', 'main')
    ).toEqual({
      label: 'http',
      title: 'Imported from https://example.com/collection.json',
      isBranchSwitcher: false
    });

    expect(
      resolveCollectionStorageBadge('https://example.com/c.json', 'sqlite', 'SQLite', null)
    ).toEqual({
      label: 'http',
      title: 'Imported from https://example.com/c.json',
      isBranchSwitcher: false
    });
  });

  it('ignores whitespace-only sourceUrl and falls back to storage badge', () => {
    expect(resolveCollectionStorageBadge('   ', 'sqlite', 'SQLite', null)).toEqual({
      label: 'SQLite',
      title: 'Stored in SQLite',
      isBranchSwitcher: false
    });
  });

  it('returns a branch switcher badge for git collections without sourceUrl', () => {
    expect(resolveCollectionStorageBadge(null, 'git', 'Git', 'main')).toEqual({
      label: 'main',
      title: 'On branch main',
      isBranchSwitcher: true
    });
  });

  it('returns the connection name for non-git storage without sourceUrl', () => {
    expect(resolveCollectionStorageBadge(undefined, 'sqlite', 'SQLite', null)).toEqual({
      label: 'SQLite',
      title: 'Stored in SQLite',
      isBranchSwitcher: false
    });
  });

  it('returns null when there is no sourceUrl and no connection name', () => {
    expect(resolveCollectionStorageBadge(null, 'sqlite', undefined, null)).toBeNull();
  });
});
