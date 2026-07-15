import { describe, expect, it } from 'vitest';
import { sidebarHasDeselectableSelection } from './sidebarDeselectAll';

describe('sidebarHasDeselectableSelection', () => {
  it('returns true when a collection is selected', () => {
    expect(
      sidebarHasDeselectableSelection({
        selectedCollectionId: 1,
        selectedFolderId: null,
        activeEnvironmentId: null,
        sectionSelectionCounts: {},
        openRequestTabCount: 0,
        openMarkdownTabCount: 0
      })
    ).toBe(true);
  });

  it('returns true when a folder is selected', () => {
    expect(
      sidebarHasDeselectableSelection({
        selectedCollectionId: 1,
        selectedFolderId: 7,
        activeEnvironmentId: null,
        sectionSelectionCounts: {},
        openRequestTabCount: 0,
        openMarkdownTabCount: 0
      })
    ).toBe(true);
  });

  it('returns true when an environment is active', () => {
    expect(
      sidebarHasDeselectableSelection({
        selectedCollectionId: null,
        selectedFolderId: null,
        activeEnvironmentId: 3,
        sectionSelectionCounts: {},
        openRequestTabCount: 0,
        openMarkdownTabCount: 0
      })
    ).toBe(true);
  });

  it('returns true when a section reports multi-selected rows', () => {
    expect(
      sidebarHasDeselectableSelection({
        selectedCollectionId: null,
        selectedFolderId: null,
        activeEnvironmentId: null,
        sectionSelectionCounts: { environments: 2 },
        openRequestTabCount: 0,
        openMarkdownTabCount: 0
      })
    ).toBe(true);
  });

  it('returns true when request or markdown tabs are open', () => {
    expect(
      sidebarHasDeselectableSelection({
        selectedCollectionId: null,
        selectedFolderId: null,
        activeEnvironmentId: null,
        sectionSelectionCounts: {},
        openRequestTabCount: 2,
        openMarkdownTabCount: 0
      })
    ).toBe(true);

    expect(
      sidebarHasDeselectableSelection({
        selectedCollectionId: null,
        selectedFolderId: null,
        activeEnvironmentId: null,
        sectionSelectionCounts: {},
        openRequestTabCount: 0,
        openMarkdownTabCount: 1
      })
    ).toBe(true);
  });

  it('returns false when nothing is selected', () => {
    expect(
      sidebarHasDeselectableSelection({
        selectedCollectionId: null,
        selectedFolderId: null,
        activeEnvironmentId: null,
        sectionSelectionCounts: { 'environments': 0, 'collections-requests': 0 },
        openRequestTabCount: 0,
        openMarkdownTabCount: 0
      })
    ).toBe(false);
  });
});
