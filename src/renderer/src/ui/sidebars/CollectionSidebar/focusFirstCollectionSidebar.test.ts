import { describe, expect, it, vi } from 'vitest';
import { setSelectedCollectionId } from '#/renderer/src/store/slices/collectionsSlice';
import { setActiveSidebarPanel, setShowSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { focusFirstCollectionSidebar } from './focusFirstCollectionSidebar';

describe('focusFirstCollectionSidebar', () => {
  it('reveals the sidebar and selects the first collection when one exists', () => {
    const dispatch = vi.fn();
    const getState = vi.fn(() => ({
      collections: {
        collections: [{ id: 42, name: 'Demo', connectionId: 1 }],
        foldersByCollection: {},
        requestsByCollection: {},
        selectedCollectionId: null,
        selectedFolderId: null,
        collectionsListed: true
      }
    }));
    const expansion = {
      setCollectionsSectionVisible: vi.fn(),
      setCollectionsSectionExpanded: vi.fn()
    };

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('document', {
      querySelector: vi.fn()
    });

    focusFirstCollectionSidebar(dispatch, getState as never, expansion);

    expect(dispatch).toHaveBeenCalledWith(setShowSidebar(true));
    expect(dispatch).toHaveBeenCalledWith(setActiveSidebarPanel(null));
    expect(expansion.setCollectionsSectionVisible).toHaveBeenCalledWith(true);
    expect(expansion.setCollectionsSectionExpanded).toHaveBeenCalledWith(true);
    expect(dispatch).toHaveBeenCalledWith(setSelectedCollectionId(42));

    vi.unstubAllGlobals();
  });
});
