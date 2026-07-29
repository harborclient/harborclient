import { describe, expect, it } from 'vitest';
import { clearExpansionSnapshot } from './useSidebarSearch';

describe('clearExpansionSnapshot', () => {
  it('clears expanded collection, folder, and environment ids while preserving section flags', () => {
    const snapshot = {
      collectionsSectionExpanded: true,
      environmentsSectionExpanded: false,
      archiveSectionExpanded: true,
      activeSidebarMode: 'workflows' as const,
      expandedCollectionIds: new Set([1, 2]),
      expandedFolderIds: new Set([9]),
      expandedEnvironmentIds: new Set([4])
    };

    expect(clearExpansionSnapshot(snapshot)).toEqual({
      collectionsSectionExpanded: true,
      environmentsSectionExpanded: false,
      archiveSectionExpanded: true,
      activeSidebarMode: 'workflows',
      expandedCollectionIds: new Set(),
      expandedFolderIds: new Set(),
      expandedEnvironmentIds: new Set()
    });
  });
});
