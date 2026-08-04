import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  setActiveSidebarPanel,
  setActiveSidebarRailItem,
  setShowSidebar
} from '#/renderer/src/store/slices/navigationSlice';
import {
  clearPluginContributions,
  registerSidebarPanelContribution
} from '#/renderer/src/plugins/registry';
import {
  COLLECTIONS_SECTION_ARIA_LABEL,
  ENVIRONMENTS_SECTION_ARIA_LABEL,
  WORKFLOWS_SECTION_ARIA_LABEL,
  focusCollectionsSidebarHeading,
  focusEnvironmentsSidebarHeading,
  focusLiveServersSidebarHeading,
  focusSidebarSectionHeading,
  focusWorkflowsSidebarHeading,
  sidebarSectionHeadingSelector
} from './focusSidebarSectionHeading';

describe('sidebarSectionHeadingSelector', () => {
  it('targets the section title label inside the rail panel', () => {
    expect(sidebarSectionHeadingSelector('Collections')).toBe(
      '#hc-sidebar-rail-panel nav[aria-label="Collections"] .hc-sidebar-section-header .hc-sidebar-section-label'
    );
  });
});

describe('focusSidebarSectionHeading', () => {
  afterEach(() => {
    clearPluginContributions('com.example.replace');
    vi.unstubAllGlobals();
  });

  /**
   * Stubs requestAnimationFrame and document.querySelector for focus helpers.
   *
   * @param querySelector - Optional querySelector mock implementation.
   */
  function stubFocusGlobals(
    querySelector: ReturnType<typeof vi.fn> = vi.fn()
  ): ReturnType<typeof vi.fn> {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('document', {
      querySelector,
      activeElement: null
    });
    return querySelector;
  }

  it('reveals the sidebar, switches mode, expands the section, and focuses the label', () => {
    const dispatch = vi.fn();
    const expansion = {
      setActiveSidebarMode: vi.fn(),
      setSectionExpanded: vi.fn()
    };
    const focus = vi.fn();
    const querySelector = stubFocusGlobals(
      vi.fn(() => ({
        focus
      }))
    );

    focusSidebarSectionHeading(dispatch, 'workflows', WORKFLOWS_SECTION_ARIA_LABEL, expansion);

    expect(dispatch).toHaveBeenCalledWith(setShowSidebar(true));
    expect(dispatch).toHaveBeenCalledWith(setActiveSidebarPanel(null));
    expect(dispatch).toHaveBeenCalledWith(setActiveSidebarRailItem(null));
    expect(expansion.setActiveSidebarMode).toHaveBeenCalledWith('workflows');
    expect(expansion.setSectionExpanded).toHaveBeenCalledWith(true);
    expect(querySelector).toHaveBeenCalledWith(
      sidebarSectionHeadingSelector(WORKFLOWS_SECTION_ARIA_LABEL)
    );
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('focuses the collections replacement panel instead of the built-in heading', () => {
    registerSidebarPanelContribution('com.example.replace', {
      id: 'plugin:com.example.replace:collections',
      title: 'My Collections',
      contributionId: 'collections',
      replaces: 'collections'
    });

    const dispatch = vi.fn();
    const expansion = {
      setActiveSidebarMode: vi.fn(),
      setSectionExpanded: vi.fn()
    };
    const querySelector = stubFocusGlobals();

    focusSidebarSectionHeading(dispatch, 'collections', COLLECTIONS_SECTION_ARIA_LABEL, expansion);

    expect(dispatch).toHaveBeenCalledWith(setShowSidebar(true));
    expect(dispatch).toHaveBeenCalledWith(setActiveSidebarPanel(null));
    expect(dispatch).toHaveBeenCalledWith(setActiveSidebarRailItem(null));
    expect(expansion.setActiveSidebarMode).not.toHaveBeenCalled();
    expect(expansion.setSectionExpanded).not.toHaveBeenCalled();
    expect(querySelector).toHaveBeenCalled();
  });

  it('no-ops for non-collections modes when a collections replacement is active', () => {
    registerSidebarPanelContribution('com.example.replace', {
      id: 'plugin:com.example.replace:collections',
      title: 'My Collections',
      contributionId: 'collections',
      replaces: 'collections'
    });

    const dispatch = vi.fn();
    const expansion = {
      setActiveSidebarMode: vi.fn(),
      setSectionExpanded: vi.fn()
    };
    stubFocusGlobals();

    focusSidebarSectionHeading(
      dispatch,
      'environments',
      ENVIRONMENTS_SECTION_ARIA_LABEL,
      expansion
    );

    expect(dispatch).not.toHaveBeenCalled();
    expect(expansion.setActiveSidebarMode).not.toHaveBeenCalled();
    expect(expansion.setSectionExpanded).not.toHaveBeenCalled();
  });

  it('exposes thin wrappers for each sidebar mode', () => {
    const dispatch = vi.fn();
    stubFocusGlobals(
      vi.fn(() => ({
        focus: vi.fn()
      }))
    );

    focusCollectionsSidebarHeading(dispatch, {
      setActiveSidebarMode: vi.fn(),
      setCollectionsSectionExpanded: vi.fn()
    });
    focusEnvironmentsSidebarHeading(dispatch, {
      setActiveSidebarMode: vi.fn(),
      setEnvironmentsSectionExpanded: vi.fn()
    });
    focusWorkflowsSidebarHeading(dispatch, {
      setActiveSidebarMode: vi.fn(),
      setWorkflowsSectionExpanded: vi.fn()
    });
    focusLiveServersSidebarHeading(dispatch, {
      setActiveSidebarMode: vi.fn(),
      setLiveServersSectionExpanded: vi.fn()
    });

    expect(dispatch).toHaveBeenCalledWith(setShowSidebar(true));
    expect(dispatch).toHaveBeenCalledWith(setActiveSidebarPanel(null));
    expect(dispatch).toHaveBeenCalledWith(setActiveSidebarRailItem(null));
  });
});
