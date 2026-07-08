import { describe, expect, it } from 'vitest';
import {
  advanceSidebarExpansionPersistGate,
  serializeSidebarExpansion,
  shouldPersistSidebarExpansion
} from '#/renderer/src/ui/Sidebar/usePersistedSidebarExpansion';

describe('serializeSidebarExpansion', () => {
  it('serializes section flags and expanded ids', () => {
    expect(
      serializeSidebarExpansion(
        { collections: false, environments: true, runResults: false },
        { collections: true, environments: false, runResults: true },
        new Set([1, 2]),
        new Set([9]),
        false
      )
    ).toEqual({
      sections: { collections: false, environments: true, runResults: false },
      sectionVisibility: { collections: true, environments: false, runResults: true },
      collectionIds: [1, 2],
      folderIds: [9],
      showStorageLocationBadges: false
    });
  });
});

describe('shouldPersistSidebarExpansion', () => {
  it('blocks writes before load and during the first post-load cycle', () => {
    expect(shouldPersistSidebarExpansion(false, true)).toBe(false);
    expect(shouldPersistSidebarExpansion(true, true)).toBe(false);
  });

  it('allows writes after hydration skip cycle completes', () => {
    expect(shouldPersistSidebarExpansion(true, false)).toBe(true);
  });
});

describe('advanceSidebarExpansionPersistGate', () => {
  it('does not persist before load completes', () => {
    const skipPersistRef = { current: true };

    expect(advanceSidebarExpansionPersistGate(false, skipPersistRef)).toBe(false);
    expect(skipPersistRef.current).toBe(true);
  });

  it('skips the first persist cycle after hydration', () => {
    const skipPersistRef = { current: true };

    expect(advanceSidebarExpansionPersistGate(true, skipPersistRef)).toBe(false);
    expect(skipPersistRef.current).toBe(false);
  });

  it('persists on subsequent cycles after hydration', () => {
    const skipPersistRef = { current: false };

    expect(advanceSidebarExpansionPersistGate(true, skipPersistRef)).toBe(true);
    expect(skipPersistRef.current).toBe(false);
  });
});
