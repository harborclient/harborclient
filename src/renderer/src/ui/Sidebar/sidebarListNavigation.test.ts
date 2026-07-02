import { describe, expect, it, vi } from 'vitest';
import { setSelectedCollectionId } from '#/renderer/src/store/slices/collectionsSlice';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import {
  advanceSidebarListItem,
  resolveCurrentCollectionRowIndex,
  resolveCurrentEnvironmentRowIndex,
  wrapSidebarRowIndex
} from '#/renderer/src/ui/Sidebar/sidebarListNavigation';

describe('wrapSidebarRowIndex', () => {
  it('wraps forward from the last row to the first', () => {
    expect(wrapSidebarRowIndex(2, 3, 1)).toBe(0);
  });

  it('wraps backward from the first row to the last', () => {
    expect(wrapSidebarRowIndex(0, 3, -1)).toBe(2);
  });

  it('returns -1 for an empty list', () => {
    expect(wrapSidebarRowIndex(0, 0, 1)).toBe(-1);
  });
});

describe('resolveCurrentCollectionRowIndex', () => {
  it('uses selectedCollectionId when focus is not on a collection row', () => {
    vi.stubGlobal('document', {
      activeElement: {}
    });

    expect(resolveCurrentCollectionRowIndex([10, 20, 30], 20)).toBe(1);

    vi.unstubAllGlobals();
  });

  it('prefers the focused collection row id', () => {
    vi.stubGlobal('document', {
      activeElement: {
        closest: () => ({
          getAttribute: () => '30'
        })
      }
    });

    expect(resolveCurrentCollectionRowIndex([10, 20, 30], 10)).toBe(2);

    vi.unstubAllGlobals();
  });
});

describe('resolveCurrentEnvironmentRowIndex', () => {
  it('uses activeEnvironmentId when focus is not on an environment row', () => {
    vi.stubGlobal('document', {
      activeElement: {}
    });

    expect(resolveCurrentEnvironmentRowIndex([5, 6], 6)).toBe(1);

    vi.unstubAllGlobals();
  });
});

describe('advanceSidebarListItem', () => {
  it('updates selection and focuses the next collection row', () => {
    const row20 = {
      focus: vi.fn(),
      scrollIntoView: vi.fn()
    };
    const section = {
      querySelectorAll: () => [{ getAttribute: () => '10' }, { getAttribute: () => '20' }]
    };

    vi.stubGlobal('document', {
      activeElement: {
        closest: (selector: string) => (selector.includes('collections') ? section : null)
      },
      querySelector: (selector: string) => {
        if (selector.includes('collections')) {
          return section;
        }
        if (selector.includes('20')) {
          return row20;
        }
        return null;
      }
    });

    const dispatch = vi.fn();
    const handled = advanceSidebarListItem({
      direction: 1,
      dispatch,
      selectedCollectionId: 10,
      activeEnvironmentId: null
    });

    expect(handled).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(setSelectedCollectionId(20));
    expect(row20.focus).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('returns false when focus is outside sidebar list sections', () => {
    vi.stubGlobal('document', {
      activeElement: {
        closest: () => null
      },
      querySelector: vi.fn()
    });

    const dispatch = vi.fn();
    const handled = advanceSidebarListItem({
      direction: 1,
      dispatch,
      selectedCollectionId: 10,
      activeEnvironmentId: null
    });

    expect(handled).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('updates selection and focuses the previous environment row', () => {
    const row5 = {
      focus: vi.fn(),
      scrollIntoView: vi.fn()
    };
    const section = {
      querySelectorAll: () => [{ getAttribute: () => '5' }, { getAttribute: () => '6' }]
    };

    vi.stubGlobal('document', {
      activeElement: {
        closest: (selector: string) => (selector.includes('environments') ? section : null)
      },
      querySelector: (selector: string) => {
        if (selector.includes('environments')) {
          return section;
        }
        if (selector.includes('5')) {
          return row5;
        }
        return null;
      }
    });

    const dispatch = vi.fn();
    const handled = advanceSidebarListItem({
      direction: -1,
      dispatch,
      selectedCollectionId: null,
      activeEnvironmentId: 6
    });

    expect(handled).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(setActiveEnvironmentId(5));
    expect(row5.focus).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
