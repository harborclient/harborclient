import { describe, expect, it, vi } from 'vitest';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import { setActiveSidebarPanel, setShowSidebar } from '#/renderer/src/store/slices/navigationSlice';
import {
  focusEnvironmentSidebarById,
  focusFirstEnvironmentSidebar
} from './focusFirstEnvironmentSidebar';

describe('focusEnvironmentSidebarById', () => {
  it('reveals the sidebar and selects the given environment', () => {
    const dispatch = vi.fn();
    const expansion = {
      setEnvironmentsSectionVisible: vi.fn(),
      setEnvironmentsSectionExpanded: vi.fn()
    };

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('document', {
      querySelector: vi.fn()
    });

    focusEnvironmentSidebarById(dispatch, 42, expansion);

    expect(dispatch).toHaveBeenCalledWith(setShowSidebar(true));
    expect(dispatch).toHaveBeenCalledWith(setActiveSidebarPanel(null));
    expect(expansion.setEnvironmentsSectionVisible).toHaveBeenCalledWith(true);
    expect(expansion.setEnvironmentsSectionExpanded).toHaveBeenCalledWith(true);
    expect(dispatch).toHaveBeenCalledWith(setActiveEnvironmentId(42));

    vi.unstubAllGlobals();
  });
});

describe('focusFirstEnvironmentSidebar', () => {
  it('reveals the sidebar and selects the first environment when one exists', () => {
    const dispatch = vi.fn();
    const getState = vi.fn(() => ({
      environments: {
        environments: [{ id: 7, name: 'Local', variables: [] }],
        activeEnvironmentId: null
      }
    }));
    const expansion = {
      setEnvironmentsSectionVisible: vi.fn(),
      setEnvironmentsSectionExpanded: vi.fn()
    };

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('document', {
      querySelector: vi.fn()
    });

    focusFirstEnvironmentSidebar(dispatch, getState as never, expansion);

    expect(dispatch).toHaveBeenCalledWith(setShowSidebar(true));
    expect(dispatch).toHaveBeenCalledWith(setActiveSidebarPanel(null));
    expect(expansion.setEnvironmentsSectionVisible).toHaveBeenCalledWith(true);
    expect(expansion.setEnvironmentsSectionExpanded).toHaveBeenCalledWith(true);
    expect(dispatch).toHaveBeenCalledWith(setActiveEnvironmentId(7));

    vi.unstubAllGlobals();
  });
});
