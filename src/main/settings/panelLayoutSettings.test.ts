import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockSet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn()
}));

vi.mock('electron-store', () => ({
  default: class MockStore {
    get = mockGet;
    set = mockSet;
  }
}));

describe('panelLayoutSettings', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGet.mockReset();
    mockSet.mockReset();
    mockGet.mockReturnValue(undefined);
  });

  it('returns defaults when unset', async () => {
    const { getPanelLayout } = await import('#/main/settings/panelLayoutSettings');

    expect(getPanelLayout()).toEqual({
      showSidebar: true,
      showAiSidebar: false,
      showGitSidebar: false,
      showRequestEditor: true,
      showResponseEditor: true,
      requestEditorSplitHeight: 340,
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      activePluginFooterPanelId: null
    });
  });

  it('clamps request editor split height to supported bounds', async () => {
    mockGet.mockReturnValue({
      showSidebar: true,
      showAiSidebar: false,
      showGitSidebar: false,
      showRequestEditor: true,
      showResponseEditor: true,
      requestEditorSplitHeight: 50
    });
    const { getPanelLayout } = await import('#/main/settings/panelLayoutSettings');

    expect(getPanelLayout().requestEditorSplitHeight).toBe(160);
  });

  it('persists normalized layout state', async () => {
    const { setPanelLayout } = await import('#/main/settings/panelLayoutSettings');

    setPanelLayout({
      showSidebar: false,
      showAiSidebar: true,
      showGitSidebar: false,
      showRequestEditor: false,
      showResponseEditor: true,
      requestEditorSplitHeight: 420,
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: true,
      activePluginFooterPanelId: null
    });

    expect(mockSet).toHaveBeenCalledWith('panelLayout', {
      showSidebar: false,
      showAiSidebar: true,
      showGitSidebar: false,
      showRequestEditor: false,
      showResponseEditor: true,
      requestEditorSplitHeight: 420,
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: true,
      activePluginFooterPanelId: null
    });
  });

  it('enforces mutual exclusivity among footer panels', async () => {
    mockGet.mockReturnValue({
      showSidebar: true,
      showAiSidebar: false,
      showGitSidebar: false,
      showRequestEditor: true,
      showResponseEditor: true,
      requestEditorSplitHeight: 340,
      showConsole: true,
      showVariables: true,
      showMcp: true,
      showTerminal: true,
      activePluginFooterPanelId: 'plugin-panel-1'
    });
    const { getPanelLayout } = await import('#/main/settings/panelLayoutSettings');

    expect(getPanelLayout()).toEqual({
      showSidebar: true,
      showAiSidebar: false,
      showGitSidebar: false,
      showRequestEditor: true,
      showResponseEditor: true,
      requestEditorSplitHeight: 340,
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      activePluginFooterPanelId: 'plugin-panel-1'
    });
  });
});
