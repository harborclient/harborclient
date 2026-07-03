import { describe, expect, it } from 'vitest';
import { clearExpansionSnapshot } from '#/renderer/src/ui/Sidebar/useSidebarSearch';

describe('clearExpansionSnapshot', () => {
  it('clears expanded collection and folder ids while preserving section flags', () => {
    const snapshot = {
      collectionsSectionExpanded: true,
      environmentsSectionExpanded: false,
      expandedCollectionIds: new Set([1, 2]),
      expandedFolderIds: new Set([9])
    };

    expect(clearExpansionSnapshot(snapshot)).toEqual({
      collectionsSectionExpanded: true,
      environmentsSectionExpanded: false,
      expandedCollectionIds: new Set(),
      expandedFolderIds: new Set()
    });
  });
});
