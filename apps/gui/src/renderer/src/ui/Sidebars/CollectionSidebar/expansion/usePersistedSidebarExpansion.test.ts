import { describe, expect, it } from 'vitest';
import {
  advanceSidebarExpansionPersistGate,
  serializeSidebarExpansion,
  shouldPersistSidebarExpansion
} from './usePersistedSidebarExpansion';

const DEFAULT_SECTION_SORT = {
  collections: 'default',
  environments: 'default',
  runResults: 'default',
  history: 'default',
  workspaces: 'default',
  archive: 'default',
  trash: 'default'
} as const;

describe('serializeSidebarExpansion', () => {
  it('serializes section flags, sort modes, and expanded ids', () => {
    expect(
      serializeSidebarExpansion(
        {
          collections: false,
          environments: true,
          runResults: false,
          history: true,
          workspaces: true,
          archive: true,
          trash: true
        },
        {
          collections: true,
          environments: false,
          runResults: true,
          history: false,
          workspaces: true,
          archive: false,
          trash: false
        },
        {
          ...DEFAULT_SECTION_SORT,
          collections: 'name-asc',
          history: 'created-desc'
        },
        new Set([1, 2]),
        new Set([9]),
        false,
        true,
        true,
        true,
        true,
        true
      )
    ).toEqual({
      sections: {
        collections: false,
        environments: true,
        runResults: false,
        history: true,
        workspaces: true,
        archive: true,
        trash: true
      },
      sectionVisibility: {
        collections: true,
        environments: false,
        runResults: true,
        history: false,
        workspaces: true,
        archive: false,
        trash: false
      },
      sectionSort: {
        ...DEFAULT_SECTION_SORT,
        collections: 'name-asc',
        history: 'created-desc'
      },
      collectionIds: [1, 2],
      folderIds: [9],
      showStorageLocationBadges: false,
      showMarkers: true,
      showMethodColors: true,
      showIndicators: true,
      showFilters: true,
      showSorting: true
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
