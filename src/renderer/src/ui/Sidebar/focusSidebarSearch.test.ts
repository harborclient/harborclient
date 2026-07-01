import { describe, expect, it, vi } from 'vitest';
import { setActiveSidebarPanel, setShowSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { focusSidebarSearch } from './focusSidebarSearch';

describe('focusSidebarSearch', () => {
  it('dispatches navigation actions to reveal the sidebar search field', () => {
    const dispatch = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('document', {
      getElementById: vi.fn()
    });

    focusSidebarSearch(dispatch);

    expect(dispatch).toHaveBeenCalledWith(setShowSidebar(true));
    expect(dispatch).toHaveBeenCalledWith(setActiveSidebarPanel(null));

    vi.unstubAllGlobals();
  });
});
