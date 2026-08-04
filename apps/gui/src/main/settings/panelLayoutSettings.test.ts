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
      showRail: true,
      sidebarPlacement: 'left',
      showAiSidebar: false,
      showGitSidebar: false,
      showShortcutsSidebar: false,
      showRequestEditor: true,
      showResponseEditor: true,
      requestEditorSplitHeight: 340,
      responseEditorSplit: null,
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      showLiveServerLogs: false,
      liveServerLogsPlacement: 'footer',
      liveServerLogsPlacements: {},
      activePluginFooterPanelId: null
    });
  });

  it('defaults missing sidebarPlacement to left', async () => {
    mockGet.mockReturnValue({
      showSidebar: true,
      showRail: true,
      showAiSidebar: false,
      showGitSidebar: false,
      showShortcutsSidebar: false,
      showRequestEditor: true,
      showResponseEditor: true,
      requestEditorSplitHeight: 340,
      responseEditorSplit: null,
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      showLiveServerLogs: false,
      liveServerLogsPlacement: 'footer',
      liveServerLogsPlacements: {},
      activePluginFooterPanelId: null
    });
    const { getPanelLayout } = await import('#/main/settings/panelLayoutSettings');

    expect(getPanelLayout().sidebarPlacement).toBe('left');
  });

  it('preserves sidebarPlacement right from storage', async () => {
    mockGet.mockReturnValue({
      showSidebar: true,
      showRail: true,
      sidebarPlacement: 'right',
      showAiSidebar: false,
      showGitSidebar: false,
      showShortcutsSidebar: false,
      showRequestEditor: true,
      showResponseEditor: true,
      requestEditorSplitHeight: 340,
      responseEditorSplit: null,
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      showLiveServerLogs: false,
      liveServerLogsPlacement: 'footer',
      liveServerLogsPlacements: {},
      activePluginFooterPanelId: null
    });
    const { getPanelLayout } = await import('#/main/settings/panelLayoutSettings');

    expect(getPanelLayout().sidebarPlacement).toBe('right');
  });

  it('defaults missing live-server logs placement to footer', async () => {
    mockGet.mockReturnValue({
      showSidebar: true,
      showLiveServerLogs: true,
      liveServerLogsPlacement: 'sidebar',
      liveServerLogsPlacements: { '3': 'sidebar', 'bad': 'nope' }
    });
    const { getPanelLayout } = await import('#/main/settings/panelLayoutSettings');

    const layout = getPanelLayout();
    expect(layout.liveServerLogsPlacement).toBe('sidebar');
    expect(layout.liveServerLogsPlacements).toEqual({ '3': 'sidebar' });
    expect(layout.showLiveServerLogs).toBe(true);
    expect(layout.showAiSidebar).toBe(false);
    expect(layout.showGitSidebar).toBe(false);
  });

  it('clamps request editor split height to supported bounds', async () => {
    mockGet.mockReturnValue({
      showSidebar: true,
      showRail: true,
      sidebarPlacement: 'left',
      showAiSidebar: false,
      showGitSidebar: false,
      showShortcutsSidebar: false,
      showRequestEditor: true,
      showResponseEditor: true,
      requestEditorSplitHeight: 50,
      responseEditorSplit: null
    });
    const { getPanelLayout } = await import('#/main/settings/panelLayoutSettings');

    expect(getPanelLayout().requestEditorSplitHeight).toBe(160);
  });

  it('persists normalized layout state', async () => {
    const { setPanelLayout } = await import('#/main/settings/panelLayoutSettings');

    setPanelLayout({
      showSidebar: false,
      showRail: false,
      sidebarPlacement: 'left',
      showAiSidebar: true,
      showGitSidebar: false,
      showShortcutsSidebar: false,
      showRequestEditor: false,
      showResponseEditor: true,
      requestEditorSplitHeight: 420,
      responseEditorSplit: null,
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: true,
      showLiveServerLogs: false,
      liveServerLogsPlacement: 'footer',
      liveServerLogsPlacements: { '7': 'sidebar' },
      activePluginFooterPanelId: null
    });

    expect(mockSet).toHaveBeenCalledWith('panelLayout', {
      showSidebar: false,
      showRail: false,
      sidebarPlacement: 'left',
      showAiSidebar: true,
      showGitSidebar: false,
      showShortcutsSidebar: false,
      showRequestEditor: false,
      showResponseEditor: true,
      requestEditorSplitHeight: 420,
      responseEditorSplit: null,
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: true,
      showLiveServerLogs: false,
      liveServerLogsPlacement: 'footer',
      liveServerLogsPlacements: { '7': 'sidebar' },
      activePluginFooterPanelId: null
    });
  });

  it('enforces mutual exclusivity among footer panels', async () => {
    mockGet.mockReturnValue({
      showSidebar: true,
      showRail: true,
      sidebarPlacement: 'left',
      showAiSidebar: false,
      showGitSidebar: false,
      showShortcutsSidebar: false,
      showRequestEditor: true,
      showResponseEditor: true,
      requestEditorSplitHeight: 340,
      responseEditorSplit: null,
      showConsole: true,
      showVariables: true,
      showMcp: true,
      showTerminal: true,
      showLiveServerLogs: true,
      activePluginFooterPanelId: 'plugin-panel-1'
    });
    const { getPanelLayout } = await import('#/main/settings/panelLayoutSettings');

    expect(getPanelLayout()).toEqual({
      showSidebar: true,
      showRail: true,
      sidebarPlacement: 'left',
      showAiSidebar: false,
      showGitSidebar: false,
      showShortcutsSidebar: false,
      showRequestEditor: true,
      showResponseEditor: true,
      requestEditorSplitHeight: 340,
      responseEditorSplit: null,
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      showLiveServerLogs: false,
      liveServerLogsPlacement: 'footer',
      liveServerLogsPlacements: {},
      activePluginFooterPanelId: 'plugin-panel-1'
    });
  });

  it('keeps sidebar-docked logs open alongside a footer console panel', async () => {
    mockGet.mockReturnValue({
      showSidebar: true,
      showRail: true,
      sidebarPlacement: 'left',
      showAiSidebar: true,
      showGitSidebar: false,
      showShortcutsSidebar: false,
      showRequestEditor: true,
      showResponseEditor: true,
      requestEditorSplitHeight: 340,
      responseEditorSplit: null,
      showConsole: true,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      showLiveServerLogs: true,
      liveServerLogsPlacement: 'sidebar',
      liveServerLogsPlacements: { '1': 'sidebar' },
      activePluginFooterPanelId: null
    });
    const { getPanelLayout } = await import('#/main/settings/panelLayoutSettings');

    expect(getPanelLayout()).toEqual({
      showSidebar: true,
      showRail: true,
      sidebarPlacement: 'left',
      showAiSidebar: false,
      showGitSidebar: false,
      showShortcutsSidebar: false,
      showRequestEditor: true,
      showResponseEditor: true,
      requestEditorSplitHeight: 340,
      responseEditorSplit: null,
      showConsole: true,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      showLiveServerLogs: true,
      liveServerLogsPlacement: 'sidebar',
      liveServerLogsPlacements: { '1': 'sidebar' },
      activePluginFooterPanelId: null
    });
  });

  it('normalizes a persisted response editor split', async () => {
    mockGet.mockReturnValue({
      responseEditorSplit: {
        side: 'right',
        secondaryTabIds: ['console', ''],
        size: 40,
        activeTab: 'missing'
      }
    });
    const { getPanelLayout } = await import('#/main/settings/panelLayoutSettings');

    expect(getPanelLayout().responseEditorSplit).toEqual({
      side: 'right',
      secondaryTabIds: ['console'],
      size: 120,
      activeTab: 'console'
    });
  });

  it('clears an empty response editor split', async () => {
    mockGet.mockReturnValue({
      responseEditorSplit: {
        side: 'left',
        secondaryTabIds: [],
        size: 280,
        activeTab: null
      }
    });
    const { getPanelLayout } = await import('#/main/settings/panelLayoutSettings');

    expect(getPanelLayout().responseEditorSplit).toBeNull();
  });
});
