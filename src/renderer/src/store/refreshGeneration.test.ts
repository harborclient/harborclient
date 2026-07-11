import { describe, expect, it } from 'vitest';
import {
  beginRefreshGeneration,
  collectionRefreshKey,
  isLatestRefreshGeneration
} from '#/renderer/src/store/refreshGeneration';

describe('refreshGeneration', () => {
  it('treats only the latest generation as current', () => {
    const key = 'collections';

    const first = beginRefreshGeneration(key);
    expect(isLatestRefreshGeneration(key, first)).toBe(true);

    const second = beginRefreshGeneration(key);
    expect(isLatestRefreshGeneration(key, first)).toBe(false);
    expect(isLatestRefreshGeneration(key, second)).toBe(true);
  });

  it('scopes generations independently per resource key', () => {
    const collectionsGeneration = beginRefreshGeneration('collections');
    const environmentsGeneration = beginRefreshGeneration('environments');

    expect(isLatestRefreshGeneration('collections', collectionsGeneration)).toBe(true);
    expect(isLatestRefreshGeneration('environments', environmentsGeneration)).toBe(true);
  });

  it('builds distinct keys for collection-scoped resources', () => {
    expect(collectionRefreshKey('folders', 1)).toBe('folders:1');
    expect(collectionRefreshKey('requests', 1)).toBe('requests:1');
    expect(collectionRefreshKey('documents', 1)).toBe('documents:1');
    expect(collectionRefreshKey('folders', 1)).not.toBe(collectionRefreshKey('requests', 1));
    expect(collectionRefreshKey('requests', 1)).not.toBe(collectionRefreshKey('documents', 1));
  });
});
